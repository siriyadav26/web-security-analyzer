import { validateUrl } from './types';
import { checkHeaders } from './headerCheck';
import { checkSSL } from './sslCheck';
import { checkPorts } from './portCheck';
import { calculateRiskScore, identifyVulnerabilities, generateSuggestions } from './riskScore';
import { AnalysisResult } from './types';

export async function analyzeUrl(url: string): Promise<AnalysisResult> {
  // Validate URL first
  const validation = validateUrl(url);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  const normalizedUrl = validation.normalizedUrl!;

  // Run checks with proper sequencing:
  // 1. SSL/HTTPS check first (highest priority)
  // 2. Headers check (includes context analysis)
  // 3. Port check (informational)
  // All in parallel since they're independent
  const [ssl, headerResult, ports] = await Promise.all([
    checkSSL(normalizedUrl),
    checkHeaders(normalizedUrl),
    checkPorts(normalizedUrl),
  ]);

  const { headers, context } = headerResult;

  // Calculate risk score with context
  const { score, riskLevel } = calculateRiskScore(headers, ssl, ports, context);

  // Identify vulnerabilities with context
  const vulnerabilities = identifyVulnerabilities(headers, ssl, ports, context);

  // Generate suggestions with context
  const suggestions = generateSuggestions(headers, ssl, ports, vulnerabilities, context);

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
    analyzedAt: new Date().toISOString(),
  };
}

export { validateUrl } from './types';
export type { AnalysisResult, HeaderResult, SSLResult, PortResult, Vulnerability, SecuritySuggestion, SiteContext } from './types';
