export interface HeaderResult {
  name: string;
  present: boolean;
  value: string | null;
  description: string;
  severity: 'critical' | 'warning' | 'info';
  confidence: 'high' | 'medium' | 'low';
  confidenceNote?: string;
}

export interface SSLResult {
  enabled: boolean;           // HTTPS is available
  trusted: boolean;           // Certificate is trusted by a CA (not self-signed)
  valid: boolean;             // Certificate date range is valid (not expired)
  protocol: string | null;
  issuer: string | null;
  expiryDate: string | null;
  daysUntilExpiry: number | null;
  certIssue: 'none' | 'self-signed' | 'expired' | 'untrusted-root' | 'hostname-mismatch' | 'revoked' | null;
  httpToHttpsRedirect: boolean | null;  // Does HTTP redirect to HTTPS?
  error: string | null;
}

export interface PortResult {
  port: number;
  service: string;
  open: boolean;
  status: 'open' | 'closed' | 'filtered';
  risk: 'none' | 'low' | 'medium' | 'high';  // Risk level of this port being open
  note?: string;  // Contextual note
}

export interface Vulnerability {
  type: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  description: string;
  recommendation: string;
  confidence: 'high' | 'medium' | 'low';
  confidenceNote?: string;
}

export interface SecuritySuggestion {
  category: string;
  priority: 'high' | 'medium' | 'low';
  title: string;
  description: string;
}

export interface SiteContext {
  hasForms: boolean;          // Does the site have form elements?
  hasLogin: boolean;          // Does the site have login/auth?
  isStaticSite: boolean;      // Likely a static/informational site?
  detectionNotes: string;     // How we determined this
}

export interface AnalysisResult {
  url: string;
  score: number;
  riskLevel: 'Low Risk' | 'Medium Risk' | 'High Risk';
  headers: HeaderResult[];
  ssl: SSLResult;
  ports: PortResult[];
  vulnerabilities: Vulnerability[];
  suggestions: SecuritySuggestion[];
  context: SiteContext;
  analyzedAt: string;
}

// SSRF protection: validate URL and block private/internal IPs
export function validateUrl(urlString: string): { valid: boolean; error?: string; normalizedUrl?: string } {
  let parsedUrl: URL;
  
  try {
    // Check for protocol prefix (must be http:// or https://, not just startsWith 'http')
    const hasProtocol = /^https?:\/\//i.test(urlString);
    parsedUrl = new URL(hasProtocol ? urlString : `https://${urlString}`);
  } catch {
    return { valid: false, error: 'Invalid URL format. Please enter a valid website URL.' };
  }

  const hostname = parsedUrl.hostname.toLowerCase();

  // Block localhost variations
  if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1' || hostname === '0.0.0.0') {
    return { valid: false, error: 'Local addresses are not allowed for security reasons.' };
  }

  // Block private IP ranges
  const privateIpPatterns = [
    /^10\./,                          // 10.0.0.0/8
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./, // 172.16.0.0/12
    /^192\.168\./,                     // 192.168.0.0/16
    /^169\.254\./,                     // Link-local
    /^fc00:/i,                         // IPv6 private
    /^fe80:/i,                         // IPv6 link-local
    /^0\./,                            // 0.0.0.0/8
  ];

  for (const pattern of privateIpPatterns) {
    if (pattern.test(hostname)) {
      return { valid: false, error: 'Private IP addresses are not allowed for security reasons.' };
    }
  }

  // Must have a TLD
  if (!hostname.includes('.') || hostname.endsWith('.local') || hostname.endsWith('.internal')) {
    return { valid: false, error: 'Invalid hostname. Please enter a public website URL.' };
  }

  return { valid: true, normalizedUrl: parsedUrl.href };
}
