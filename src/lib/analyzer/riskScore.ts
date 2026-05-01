import { HeaderResult, SSLResult, PortResult, Vulnerability, SecuritySuggestion, SiteContext, ScoreBreakdownItem } from './types';

/**
 * Rebalanced Risk Scoring System v2
 * 
 * Features:
 * 1. Score breakdown — every deduction is tracked and explained
 * 2. Primary risk — the #1 issue that most impacts the score
 * 3. API-aware — irrelevant headers don't affect score
 * 4. Context-aware — deductions adjusted by site type
 * 5. Limitations — tracks caveats about the analysis
 * 
 * Score mapping:
 * 80-100 → Low Risk
 * 50-79  → Medium Risk
 * 0-49   → High Risk
 */
export function calculateRiskScore(
  headers: HeaderResult[],
  ssl: SSLResult,
  ports: PortResult[],
  context: SiteContext
): {
  score: number;
  riskLevel: 'Low Risk' | 'Medium Risk' | 'High Risk';
  breakdown: ScoreBreakdownItem[];
  primaryRisk: string | null;
} {
  let score = 100;
  const breakdown: ScoreBreakdownItem[] = [];
  const isApi = context.isApi || context.siteType === 'api';
  const isStaticNoAuth = context.siteType === 'static' && !context.hasLogin;

  // ===== SSL/HTTPS deductions (HIGHEST PRIORITY) =====
  // Check if HTTPS server exists but is untrusted (has TLS but cert verification fails)
  const hasUntrustedTLS = !ssl.enabled && !ssl.httpsVerified && ssl.protocol !== null;

  if (!ssl.enabled) {
    if (hasUntrustedTLS) {
      // TLS server exists but certificate is not trusted — this is different from "no HTTPS at all"
      score -= 40;
      const issueLabel = ssl.certIssue === 'self-signed' ? 'Self-signed certificate' :
                        ssl.certIssue === 'expired' ? 'Expired certificate' :
                        ssl.certIssue === 'hostname-mismatch' ? 'Hostname mismatch' :
                        'Untrusted certificate';
      breakdown.push({ label: `${issueLabel} (HTTPS unavailable)`, points: -40, category: 'ssl' });
    } else {
      // Truly no HTTPS at all (no TLS server on port 443)
      score -= 40;
      breakdown.push({ label: 'No HTTPS encryption', points: -40, category: 'ssl' });
    }
  } else {
    breakdown.push({ label: 'HTTPS enabled', points: 0, category: 'ssl' });

    if (!ssl.trusted) {
      // Certificate not trusted by CA
      score -= 40;
      const issueLabel = ssl.certIssue === 'self-signed' ? 'Self-signed certificate' :
                        ssl.certIssue === 'expired' ? 'Expired certificate' :
                        ssl.certIssue === 'hostname-mismatch' ? 'Hostname mismatch' :
                        'Untrusted certificate';
      breakdown.push({ label: issueLabel, points: -40, category: 'ssl' });
    } else {
      breakdown.push({ label: 'Trusted SSL certificate', points: 0, category: 'ssl' });
    }

    if (ssl.trusted && !ssl.valid) {
      score -= 35;
      breakdown.push({ label: 'Certificate date invalid', points: -35, category: 'ssl' });
    }

    if (ssl.valid && ssl.daysUntilExpiry !== null && ssl.daysUntilExpiry < 30) {
      score -= 5;
      breakdown.push({ label: `Certificate expiring in ${ssl.daysUntilExpiry} days`, points: -5, category: 'ssl' });
    }

    // No HTTP→HTTPS redirect
    if (ssl.httpToHttpsRedirect === false) {
      score -= 5;
      breakdown.push({ label: 'No HTTP-to-HTTPS redirect', points: -5, category: 'ssl' });
    } else if (ssl.httpToHttpsRedirect === true) {
      breakdown.push({ label: 'HTTP redirects to HTTPS', points: 0, category: 'ssl' });
    }
  }

  // ===== Security header deductions (CONTEXT-AWARE) =====
  for (const header of headers) {
    // Skip special headers
    if (header.name === 'Server-Info-Exposure') {
      if (header.present) {
        score -= 1;
        breakdown.push({ label: 'Server version exposed', points: -1, category: 'header' });
      }
      continue;
    }
    if (header.name === 'Cookie-Security') {
      if (header.present) {
        score -= 2;
        breakdown.push({ label: 'Cookies missing security flags', points: -2, category: 'header' });
      }
      continue;
    }

    if (!header.present) {
      // API endpoints: irrelevant headers get NO deduction
      if (header.severity === 'irrelevant') {
        continue;
      }

      let deduction = 0;
      switch (header.name) {
        case 'Content-Security-Policy':
          if (isApi) {
            // No deduction for APIs (already handled by 'irrelevant' above, but safety check)
            deduction = 0;
          } else if (context.hasLogin) {
            deduction = -10; // Critical for auth sites
          } else if (isStaticNoAuth) {
            deduction = -5; // Less critical for static sites
          } else {
            deduction = -10; // Standard deduction for interactive sites
          }
          break;

        case 'Strict-Transport-Security':
          if (ssl.enabled) {
            if (isApi) {
              deduction = -5; // Less critical for APIs but still matters
            } else if (context.hasLogin) {
              deduction = -10; // Critical for auth sites
            } else {
              deduction = -10; // Standard
            }
          } else {
            deduction = -3; // HSTS irrelevant without HTTPS
          }
          break;

        case 'X-Frame-Options':
          if (isApi) {
            deduction = 0; // Irrelevant for APIs
          } else if (isStaticNoAuth) {
            deduction = -2;
          } else {
            deduction = -5;
          }
          break;

        case 'X-Content-Type-Options':
          deduction = -3;
          break;

        case 'Referrer-Policy':
          if (isApi) {
            deduction = 0; // Irrelevant for APIs
          } else {
            deduction = -2;
          }
          break;

        case 'Permissions-Policy':
          deduction = -1;
          break;

        case 'X-XSS-Protection':
          if (isApi) {
            deduction = 0; // Irrelevant for APIs
          } else {
            deduction = -1;
          }
          break;

        default:
          deduction = -2;
      }

      score += deduction; // deduction is negative, so we add it
      if (deduction !== 0) {
        breakdown.push({
          label: `Missing ${header.name}`,
          points: deduction,
          category: 'header',
        });
      }
    } else {
      // Header is present — show as positive in breakdown
      breakdown.push({
        label: `${header.name} present`,
        points: 0,
        category: 'header',
      });
    }
  }

  // ===== Port deductions (INFO ONLY — don't heavily penalize) =====
  for (const port of ports) {
    if (port.open) {
      if (port.port === 21) {
        score -= 5;
        breakdown.push({ label: 'FTP port open (plaintext)', points: -5, category: 'port' });
      }
      if (port.port === 22) {
        score -= 1;
        breakdown.push({ label: 'SSH port accessible', points: -1, category: 'port' });
      }
    }
  }

  // Clamp score between 0 and 100
  score = Math.max(0, Math.min(100, score));

  let riskLevel: 'Low Risk' | 'Medium Risk' | 'High Risk';
  if (score >= 80) {
    riskLevel = 'Low Risk';
  } else if (score >= 50) {
    riskLevel = 'Medium Risk';
  } else {
    riskLevel = 'High Risk';
  }

  // Determine primary risk (the single issue with the largest deduction)
  const primaryRisk = determinePrimaryRisk(breakdown, ssl);

  return { score, riskLevel, breakdown, primaryRisk };
}

/**
 * Determine the primary risk — the single most impactful issue.
 */
function determinePrimaryRisk(
  breakdown: ScoreBreakdownItem[],
  ssl: SSLResult
): string | null {
  // Filter to deductions only, sorted by magnitude
  const deductions = breakdown
    .filter(b => b.points < 0)
    .sort((a, b) => a.points - b.points); // Most negative first

  if (deductions.length === 0) {
    return null;
  }

  const top = deductions[0];

  // Provide clear, actionable primary risk description
  if (top.category === 'ssl') {
    if (top.label.includes('No HTTPS')) {
      return 'No HTTPS Encryption — All data is transmitted in plaintext';
    }
    if (top.label.includes('Self-signed')) {
      return 'Self-Signed SSL Certificate — Browsers will show security warnings';
    }
    if (top.label.includes('Expired')) {
      return 'Expired SSL Certificate — Browsers will block or warn about this site';
    }
    if (top.label.includes('Hostname')) {
      return 'SSL Certificate Hostname Mismatch — Certificate was issued for a different domain';
    }
    if (top.label.includes('Untrusted')) {
      return 'Untrusted SSL Certificate — Certificate chain cannot be verified';
    }
    if (top.label.includes('date invalid')) {
      return 'Invalid SSL Certificate Dates — Certificate date range is not valid';
    }
    if (top.label.includes('expiring')) {
      return 'SSL Certificate Expiring Soon — Renew before expiration to avoid service disruption';
    }
    if (top.label.includes('redirect')) {
      return 'No HTTP-to-HTTPS Redirect — Users can access the insecure HTTP version';
    }
    return top.label;
  }

  if (top.category === 'header') {
    if (top.label.includes('CSP') || top.label.includes('Content-Security-Policy')) {
      return 'Missing Content-Security-Policy — Increases XSS and injection attack risk';
    }
    if (top.label.includes('HSTS') || top.label.includes('Strict-Transport-Security')) {
      return 'Missing HSTS — Browser may access the site over insecure HTTP';
    }
    if (top.label.includes('X-Frame')) {
      return 'Missing X-Frame-Options — Page may be vulnerable to clickjacking';
    }
    // For other header deductions, provide a clean description
    if (top.label.includes('Cookie')) {
      return 'Cookie Security Flags — Some cookies missing Secure/HttpOnly flags';
    }
    if (top.label.includes('Server')) {
      return 'Server Version Exposure — Server header reveals version information';
    }
    const cleanLabel = top.label.startsWith('Missing ') ? top.label.replace('Missing ', '') : top.label;
    return `Missing ${cleanLabel} — Consider adding this security header`;
  }

  if (top.category === 'port') {
    if (top.label.includes('FTP')) {
      return 'FTP Port Open — Credentials and data transmitted in plaintext';
    }
    if (top.label.includes('SSH')) {
      return 'SSH Port Accessible — Can be targeted for brute-force attacks';
    }
    return top.label;
  }

  return top.label;
}

/**
 * Identify vulnerabilities with professional messaging and confidence levels.
 * Now API-aware: browser-specific headers are not flagged for APIs.
 */
export function identifyVulnerabilities(
  headers: HeaderResult[],
  ssl: SSLResult,
  ports: PortResult[],
  context: SiteContext
): Vulnerability[] {
  const vulnerabilities: Vulnerability[] = [];
  const isStaticNoAuth = context.siteType === 'static' && !context.hasLogin;
  const isApi = context.isApi || context.siteType === 'api';
  const hasUntrustedTLS = !ssl.enabled && !ssl.httpsVerified && ssl.protocol !== null;

  // ===== SSL/HTTPS vulnerabilities (HIGHEST PRIORITY — listed first) =====
  if (!ssl.enabled) {
    if (hasUntrustedTLS) {
      // TLS server exists but cert is untrusted — browsers would block access
      const issueType = ssl.certIssue;
      let description: string;
      let severity: 'critical' | 'high';
      let recommendation: string;

      switch (issueType) {
        case 'self-signed':
          description = 'The server has an HTTPS endpoint with a self-signed certificate. Browsers will display security warnings and may block access entirely. This is effectively the same as having no HTTPS from a user trust perspective.';
          recommendation = 'Obtain a certificate from a trusted Certificate Authority (e.g., Let\'s Encrypt, DigiCert, Cloudflare). Self-signed certificates should only be used in internal/testing environments.';
          severity = 'critical';
          break;
        case 'expired':
          description = 'The server has an HTTPS endpoint with an expired certificate. Browsers will display security warnings and may block access entirely. This is effectively the same as having no HTTPS from a user trust perspective.';
          recommendation = 'Renew the SSL certificate immediately. Set up automated renewal (e.g., certbot with cron) to prevent future expirations.';
          severity = 'critical';
          break;
        default:
          description = 'The server has an HTTPS endpoint but the certificate cannot be verified as trusted. Browsers will display security warnings and may block access entirely.';
          recommendation = 'Obtain a certificate from a trusted Certificate Authority. Ensure the full certificate chain is properly installed.';
          severity = 'critical';
      }

      vulnerabilities.push({
        type: 'Untrusted SSL Certificate',
        severity,
        description,
        recommendation,
        confidence: 'high',
      });
    } else {
      // Truly no HTTPS at all
      vulnerabilities.push({
        type: 'No HTTPS Encryption',
        severity: 'critical',
        description: 'The website does not use HTTPS. All data transmitted between the client and server is unencrypted and can be intercepted by third parties.',
        recommendation: 'Obtain an SSL/TLS certificate and configure your server to use HTTPS. Consider using Let\'s Encrypt for free certificates.',
        confidence: 'high',
      });
    }
  } else if (!ssl.trusted) {
    const issueType = ssl.certIssue;
    let description: string;
    let severity: 'critical' | 'high' | 'medium';
    let recommendation: string;

    switch (issueType) {
      case 'self-signed':
        description = 'The SSL certificate is self-signed and not trusted by browser certificate stores. Users will see security warnings when visiting this site.';
        recommendation = 'Obtain a certificate from a trusted Certificate Authority (e.g., Let\'s Encrypt, DigiCert, Cloudflare). Self-signed certificates should only be used in internal/testing environments.';
        severity = 'high';
        break;
      case 'expired':
        description = 'The SSL certificate has expired. Browsers will display security warnings and may block access to the site entirely.';
        recommendation = 'Renew the SSL certificate immediately. Set up automated renewal (e.g., certbot with cron) to prevent future expirations.';
        severity = 'critical';
        break;
      case 'hostname-mismatch':
        description = 'The SSL certificate does not match the hostname. This means the certificate was issued for a different domain, and browsers will show security warnings.';
        recommendation = 'Obtain a certificate that covers this domain. Use Subject Alternative Names (SANs) if you need to cover multiple domains.';
        severity = 'high';
        break;
      case 'untrusted-root':
        description = 'The SSL certificate is signed by an untrusted Certificate Authority. Browsers will display security warnings and may block access.';
        recommendation = 'Obtain a certificate from a well-known, trusted Certificate Authority. If using a private CA, ensure all clients have the root certificate installed.';
        severity = 'high';
        break;
      default:
        description = 'The SSL certificate cannot be verified as trusted. This may indicate a self-signed certificate, expired certificate, or untrusted certificate chain.';
        recommendation = 'Verify your SSL certificate configuration. Ensure the full certificate chain is properly installed and the certificate is from a trusted CA.';
        severity = 'high';
    }

    vulnerabilities.push({
      type: 'Untrusted SSL Certificate',
      severity,
      description,
      recommendation,
      confidence: 'high',
    });
  } else if (ssl.valid && ssl.daysUntilExpiry !== null && ssl.daysUntilExpiry < 30) {
    vulnerabilities.push({
      type: 'SSL Certificate Expiring Soon',
      severity: 'medium',
      description: `The SSL certificate expires in ${ssl.daysUntilExpiry} days. An expired certificate will cause browser warnings and disrupt service.`,
      recommendation: 'Renew the SSL certificate before it expires. Set up automated renewal to avoid future disruptions.',
      confidence: 'high',
    });
  }

  // HTTP not redirecting to HTTPS
  if (ssl.enabled && ssl.httpToHttpsRedirect === false) {
    vulnerabilities.push({
      type: 'No HTTP-to-HTTPS Redirect',
      severity: 'medium',
      description: 'The HTTP version of this site does not redirect to HTTPS. Users who type the HTTP URL will access the insecure version.',
      recommendation: 'Configure your web server to redirect all HTTP traffic to HTTPS using a 301 or 302 redirect.',
      confidence: 'high',
    });
  }

  // ===== Header vulnerabilities (SECONDARY PRIORITY, API-AWARE) =====
  for (const header of headers) {
    // Skip special headers handled separately
    if (header.name === 'Server-Info-Exposure' || header.name === 'Cookie-Security') {
      continue;
    }

    // Skip irrelevant headers (for APIs)
    if (header.severity === 'irrelevant') {
      continue;
    }

    if (!header.present) {
      switch (header.name) {
        case 'Content-Security-Policy':
          vulnerabilities.push({
            type: 'Missing Content-Security-Policy',
            severity: isStaticNoAuth ? 'medium' : 'high',
            description: isStaticNoAuth
              ? 'No Content-Security-Policy header detected. While this site appears to be static/informational (reducing XSS risk), CSP is still recommended as defense-in-depth.'
              : 'No Content-Security-Policy header detected. This may increase exposure to XSS and code injection attacks depending on application behavior.',
            recommendation: 'Implement a Content-Security-Policy header to restrict sources of executable scripts and other content. Start with a restrictive policy and loosen as needed.',
            confidence: header.confidence || 'medium',
            confidenceNote: header.confidenceNote,
          });
          break;

        case 'Strict-Transport-Security':
          if (ssl.enabled) {
            vulnerabilities.push({
              type: 'Missing HSTS',
              severity: isApi ? 'medium' : 'high',
              description: isApi
                ? 'No Strict-Transport-Security header detected. For API endpoints, HSTS is less critical than for browser-facing sites, but still recommended if any browser consumers exist.'
                : 'No Strict-Transport-Security header detected. Without HSTS, browsers may access the site over HTTP before redirecting, exposing session cookies to interception.',
              recommendation: 'Add Strict-Transport-Security header (e.g., max-age=31536000; includeSubDomains) to enforce HTTPS connections.',
              confidence: header.confidence || 'high',
              confidenceNote: header.confidenceNote,
            });
          } else {
            vulnerabilities.push({
              type: 'Missing HSTS',
              severity: 'info',
              description: 'No Strict-Transport-Security header detected. HSTS is only effective when HTTPS is enabled — address HTTPS first.',
              recommendation: 'Enable HTTPS first, then add the Strict-Transport-Security header.',
              confidence: 'high',
            });
          }
          break;

        case 'X-Frame-Options':
          vulnerabilities.push({
            type: 'Missing X-Frame-Options',
            severity: isStaticNoAuth ? 'low' : 'medium',
            description: isStaticNoAuth
              ? 'No X-Frame-Options header detected. For static content, clickjacking risk is lower, but the header is still recommended.'
              : 'No X-Frame-Options header detected. This may increase exposure to clickjacking attacks where malicious sites embed this page in frames.',
            recommendation: 'Add X-Frame-Options header (DENY or SAMEORIGIN) or use Content-Security-Policy frame-ancestors directive.',
            confidence: header.confidence || 'high',
            confidenceNote: header.confidenceNote,
          });
          break;

        case 'X-Content-Type-Options':
          vulnerabilities.push({
            type: 'MIME Sniffing Risk',
            severity: 'low',
            description: 'No X-Content-Type-Options header detected. Browsers may MIME-sniff responses and interpret files as a different content type. This is a defense-in-depth measure.',
            recommendation: 'Add X-Content-Type-Options: nosniff header to prevent browsers from interpreting files as a different MIME type.',
            confidence: header.confidence || 'high',
            confidenceNote: header.confidenceNote,
          });
          break;

        case 'Referrer-Policy':
          vulnerabilities.push({
            type: 'Referrer Information Leak',
            severity: 'info',
            description: 'No Referrer-Policy header detected. URL parameters and paths may be included in Referer headers when navigating to third-party sites.',
            recommendation: 'Add Referrer-Policy header (e.g., strict-origin-when-cross-origin) to control referrer information sharing.',
            confidence: header.confidence || 'high',
            confidenceNote: header.confidenceNote,
          });
          break;
      }
    }
  }

  // Server info exposure — informational only
  const serverInfo = headers.find(h => h.name === 'Server-Info-Exposure');
  if (serverInfo?.present) {
    vulnerabilities.push({
      type: 'Server Version Disclosure',
      severity: 'info',
      description: `Server header reveals: "${serverInfo.value}". This information alone is not a vulnerability but could help attackers identify known vulnerabilities specific to this server version.`,
      recommendation: 'Consider hiding or obfuscating the Server header. While this is security through obscurity, it adds a small layer of defense.',
      confidence: 'high',
      confidenceNote: 'Server header exposure is low risk. It only matters if the server version has known vulnerabilities.',
    });
  }

  // Cookie security — informational
  const cookieSecurity = headers.find(h => h.name === 'Cookie-Security');
  if (cookieSecurity?.present) {
    vulnerabilities.push({
      type: 'Cookie Flag Review Recommended',
      severity: 'info',
      description: `${cookieSecurity.value}. Session cookies should always have Secure and HttpOnly flags. However, not all cookies (e.g., analytics, preferences) require these flags.`,
      recommendation: 'Review which cookies are session-related and ensure they have Secure and HttpOnly flags set. Non-session cookies may not require these flags.',
      confidence: 'low',
      confidenceNote: 'Cookie flags are observed from the initial HTTP response. Not all cookies require Secure/HttpOnly — it depends on the cookie\'s purpose.',
    });
  }

  // ===== Port vulnerabilities (INFO ONLY) =====
  for (const port of ports) {
    if (port.open && port.port === 21) {
      vulnerabilities.push({
        type: 'FTP Port Open',
        severity: 'medium',
        description: 'FTP port (21) is open. FTP transmits credentials and data in plaintext, making it vulnerable to interception. This does not affect web traffic security directly.',
        recommendation: 'Consider replacing FTP with SFTP or FTPS for encrypted file transfers, or disable FTP if not needed.',
        confidence: 'high',
      });
    }
    if (port.open && port.port === 22) {
      vulnerabilities.push({
        type: 'SSH Port Accessible',
        severity: 'info',
        description: 'SSH port (22) is open and accessible. While SSH is encrypted, exposed SSH can be targeted for brute-force attacks. This is common for many servers.',
        recommendation: 'Consider restricting SSH access to specific IP ranges, using key-based authentication, or changing the default port to reduce automated attacks.',
        confidence: 'high',
      });
    }
  }

  return vulnerabilities;
}

/**
 * Generate security suggestions with prioritized, contextual recommendations.
 */
export function generateSuggestions(
  headers: HeaderResult[],
  ssl: SSLResult,
  ports: PortResult[],
  vulnerabilities: Vulnerability[],
  context: SiteContext
): SecuritySuggestion[] {
  const suggestions: SecuritySuggestion[] = [];
  const isApi = context.isApi || context.siteType === 'api';

  // ===== SSL/HTTPS suggestions (HIGHEST PRIORITY) =====
  if (!ssl.enabled) {
    suggestions.push({
      category: 'SSL/TLS',
      priority: 'high',
      title: 'Enable HTTPS Immediately',
      description: 'Your website does not use HTTPS encryption. This is the most critical security improvement you can make. Obtain a free SSL certificate from Let\'s Encrypt and configure your web server to serve all traffic over HTTPS with proper redirects from HTTP.',
    });
  } else if (!ssl.trusted) {
    suggestions.push({
      category: 'SSL/TLS',
      priority: 'high',
      title: 'Fix Your SSL Certificate',
      description: `Your SSL certificate is not trusted by browsers (${ssl.certIssue || 'unknown issue'}). This causes browser warnings that erode user trust and can lead to users abandoning your site. Obtain a certificate from a trusted Certificate Authority like Let's Encrypt, DigiCert, or Cloudflare.`,
    });
  } else if (ssl.daysUntilExpiry !== null && ssl.daysUntilExpiry < 90) {
    suggestions.push({
      category: 'SSL/TLS',
      priority: 'medium',
      title: 'Plan SSL Certificate Renewal',
      description: `Your SSL certificate expires in ${ssl.daysUntilExpiry} days. Set up automated renewal (e.g., certbot with cron) to avoid unexpected certificate expiration and service disruption.`,
    });
  }

  // HTTP→HTTPS redirect suggestion
  if (ssl.enabled && ssl.httpToHttpsRedirect === false) {
    suggestions.push({
      category: 'SSL/TLS',
      priority: 'medium',
      title: 'Add HTTP-to-HTTPS Redirect',
      description: 'Your site is accessible over HTTP without redirecting to HTTPS. Configure your web server to redirect all HTTP traffic to HTTPS using a 301 redirect to ensure users always use the secure version.',
    });
  }

  // ===== Header suggestions (CONTEXT-AWARE) =====
  const missingCriticalHeaders = headers.filter(h => !h.present && h.severity === 'critical');
  if (missingCriticalHeaders.length > 0 && ssl.enabled) {
    suggestions.push({
      category: 'Security Headers',
      priority: 'high',
      title: 'Implement Critical Security Headers',
      description: `Your website is missing ${missingCriticalHeaders.length} critical security header(s): ${missingCriticalHeaders.map(h => h.name).join(', ')}. ${context.hasLogin ? 'Since this site handles authentication, these headers are especially important to protect user sessions.' : 'These headers protect against XSS, clickjacking, and protocol downgrade attacks.'}`,
    });
  }

  const missingWarningHeaders = headers.filter(h => !h.present && h.severity === 'warning');
  if (missingWarningHeaders.length > 0) {
    suggestions.push({
      category: 'Security Headers',
      priority: 'medium',
      title: 'Add Warning-Level Security Headers',
      description: `Consider adding ${missingWarningHeaders.map(h => h.name).join(', ')} to further harden your website. These headers provide defense-in-depth protections against content-type confusion and clickjacking.`,
    });
  }

  // API-specific suggestion
  if (isApi) {
    const irrelevantHeaders = headers.filter(h => h.severity === 'irrelevant');
    if (irrelevantHeaders.length > 0) {
      suggestions.push({
        category: 'API Security',
        priority: 'info',
        title: 'Browser Headers Not Applicable',
        description: `This is an API endpoint. The following headers are designed for browser-side protection and do not apply to APIs: ${irrelevantHeaders.map(h => h.name).join(', ')}. Focus on API-specific security: authentication, rate limiting, input validation, and HTTPS enforcement.`,
      });
    }
  }

  // Server info exposure suggestion
  const serverInfo = headers.find(h => h.name === 'Server-Info-Exposure');
  if (serverInfo?.present) {
    suggestions.push({
      category: 'Information Disclosure',
      priority: 'low',
      title: 'Hide Server Version Information',
      description: `Your server reveals: "${serverInfo.value}". While this is low risk on its own, obfuscating the Server header can slightly reduce the information available to potential attackers.`,
    });
  }

  // Cookie security suggestion
  const cookieSecurity = headers.find(h => h.name === 'Cookie-Security');
  if (cookieSecurity?.present) {
    suggestions.push({
      category: 'Cookie Security',
      priority: 'low',
      title: 'Review Cookie Security Flags',
      description: 'Some cookies may be missing Secure and/or HttpOnly flags. Review your cookies to ensure session-related cookies have both flags. Non-session cookies (analytics, preferences) may not require these flags.',
    });
  }

  // Port suggestions
  const ftpOpen = ports.find(p => p.port === 21 && p.open);
  if (ftpOpen) {
    suggestions.push({
      category: 'Network Security',
      priority: 'medium',
      title: 'Replace FTP with Secure Alternatives',
      description: 'FTP port is open and transmitting data in plaintext. Consider migrating to SFTP (SSH File Transfer Protocol) or FTPS (FTP over TLS) to encrypt file transfers and credentials.',
    });
  }

  // General suggestion if critical/high issues exist
  const criticalVulns = vulnerabilities.filter(v => v.severity === 'critical');
  const highVulns = vulnerabilities.filter(v => v.severity === 'high');

  if (criticalVulns.length > 0 || highVulns.length > 0) {
    suggestions.push({
      category: 'Overall Security',
      priority: 'high',
      title: 'Address Critical and High Severity Issues',
      description: `We found ${criticalVulns.length} critical and ${highVulns.length} high severity issues. Prioritize fixing these first as they represent the most significant security risks. Consider conducting a more comprehensive security audit after addressing these findings.`,
    });
  }

  // If everything is good
  if (suggestions.length === 0) {
    suggestions.push({
      category: 'Overall Security',
      priority: 'low',
      title: 'Maintain Your Good Security Posture',
      description: 'Your website has a strong security posture. Continue to monitor for new vulnerabilities, keep your server software updated, and periodically review your security headers and SSL configuration.',
    });
  }

  return suggestions;
}

/**
 * Generate limitations list based on analysis conditions.
 */
export function generateLimitations(
  analysisMode: 'secure' | 'fallback',
  context: SiteContext,
  ssl: SSLResult
): string[] {
  const limitations: string[] = [];

  if (analysisMode === 'fallback') {
    limitations.push('Header analysis was performed using a fallback method (SSL certificate verification was bypassed). Results may be partially unreliable.');
  }

  if (context.siteType === 'unknown') {
    limitations.push('Could not determine site type. Risk assessments use default (interactive site) severity levels, which may overestimate risk for static sites or APIs.');
  }

  if (ssl.httpToHttpsRedirect === null) {
    limitations.push('Could not verify HTTP-to-HTTPS redirect behavior. The site may or may not redirect HTTP traffic to HTTPS.');
  }

  if (context.isApi) {
    limitations.push('Browser-specific security headers (CSP, X-Frame-Options, X-XSS-Protection) are not applicable to API endpoints and have been excluded from scoring.');
  }

  // Add generic limitations
  limitations.push('This analysis checks a single page/endpoint. Security headers and behavior may differ across different routes and endpoints.');
  limitations.push('Dynamically applied headers (via JavaScript or specific routes) may not be detected in this analysis.');

  return limitations;
}
