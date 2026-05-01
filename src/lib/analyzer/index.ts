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

  // Run all checks in parallel
  const [headers, ssl, ports] = await Promise.all([
    checkHeaders(normalizedUrl),
    checkSSL(normalizedUrl),
    checkPorts(normalizedUrl),
  ]);

  // Calculate risk score
  const { score, riskLevel } = calculateRiskScore(headers, ssl, ports);

  // Identify vulnerabilities
  const vulnerabilities = identifyVulnerabilities(headers, ssl, ports);

  // Generate suggestions
  const suggestions = generateSuggestions(headers, ssl, ports, vulnerabilities);

  return {
    url: normalizedUrl,
    score,
    riskLevel,
    headers,
    ssl,
    ports,
    vulnerabilities,
    suggestions,
    analyzedAt: new Date().toISOString(),
  };
}

export { validateUrl } from './types';
export type { AnalysisResult, HeaderResult, SSLResult, PortResult, Vulnerability, SecuritySuggestion } from './types';
