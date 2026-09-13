import { validateUrl } from './types';
import { checkHeaders } from './headerCheck';
import { checkSSL } from './sslCheck';
import { checkPorts } from './portCheck';
import { calculateRiskScore, identifyVulnerabilities, generateSuggestions, generateLimitations } from './riskScore';
import { AnalysisResult } from './types';

export async function analyzeUrl(url: string): Promise<AnalysisResult> {
  // Validate URL first
  const validation = validateUrl(url);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  const normalizedUrl = validation.normalizedUrl!;

  // ===== CLEAN DATA FLOW ARCHITECTURE =====
  //
  // Phase 1: DATA COLLECTION (sequential-parallel hybrid)
  //   Step 1: SSL/TLS analysis (must complete first — affects header severity)
  //   Step 2: Header extraction + context detection (needs SSL result)
  //          + Port scanning (independent, can run parallel with headers)
  //
  // Phase 2: INTERPRETATION
  //   - Context-based header severity adjustment (done in headerCheck using SSL info)
  //   - Vulnerability identification (done in riskScore)
  //
  // Phase 3: SCORING
  //   - Risk score calculation with breakdown
  //   - Primary risk identification
  //   - Limitations tracking
  //
  // Phase 4: REPORTING
  //   - Suggestions generation
  //   - Final result assembly

  // Phase 1, Step 1: SSL must run first — its result affects header severity (e.g., HSTS relevance)
  const ssl = await checkSSL(normalizedUrl);

  // Phase 1, Step 2: Headers (with SSL context), then Ports — run sequentially to avoid
  // too many simultaneous outbound connections that can crash the Node.js server
  const headerResult = await checkHeaders(normalizedUrl, ssl);
  const ports = await checkPorts(normalizedUrl);

  const { headers, context, analysisMode } = headerResult;

  // Phase 2 & 3: Interpretation + Scoring
  const { score, riskLevel, breakdown, primaryRisk } = calculateRiskScore(headers, ssl, ports, context);

  // Phase 2: Vulnerability identification
  const vulnerabilities = identifyVulnerabilities(headers, ssl, ports, context);

  // Phase 4: Reporting
  const suggestions = generateSuggestions(headers, ssl, ports, vulnerabilities, context);

  // Generate limitations
  const limitations = generateLimitations(analysisMode, context, ssl);

  return {
    url: normalizedUrl,
    score,
    riskLevel,
    headers,
    ssl,
    ports,
    vulnerabilities,
    suggestions,
    context,
    analysisMode,
    limitations,
    scoreBreakdown: breakdown,
    primaryRisk,
    analyzedAt: new Date().toISOString(),
  };
}

export { validateUrl } from './types';
export type { AnalysisResult, HeaderResult, SSLResult, PortResult, Vulnerability, SecuritySuggestion, SiteContext, SiteType, ScoreBreakdownItem } from './types';
