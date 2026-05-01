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
  // Phase 1: DATA COLLECTION (parallel)
  //   - SSL/TLS analysis
  //   - Header extraction + context detection
  //   - Port scanning
  //
  // Phase 2: INTERPRETATION
  //   - Context-based header severity adjustment (done in headerCheck)
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

  // Phase 1: Data Collection
  const [ssl, headerResult, ports] = await Promise.all([
    checkSSL(normalizedUrl),
    checkHeaders(normalizedUrl),
    checkPorts(normalizedUrl),
  ]);

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
