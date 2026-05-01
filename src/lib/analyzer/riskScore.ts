import { HeaderResult, SSLResult, PortResult, Vulnerability, SecuritySuggestion, SiteContext } from './types';

/**
 * Rebalanced Risk Scoring System
 * 
 * Priority order:
 * 1. SSL/HTTPS issues (highest impact) — -40 each
 * 2. Critical missing headers (CSP, HSTS) — -10 each
 * 3. Warning missing headers — -5 each
 * 4. Info missing headers — -2 each
 * 5. Server info exposure — -1
 * 6. Cookie issues — -2
 * 7. Open risky ports (FTP) — -5
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
): { score: number; riskLevel: 'Low Risk' | 'Medium Risk' | 'High Risk' } {
  let score = 100;

  // ===== SSL/HTTPS deductions (HIGHEST PRIORITY) =====
  if (!ssl.enabled) {
    score -= 40; // No HTTPS is a critical issue
  } else {
    if (!ssl.trusted) {
      // Certificate not trusted by CA (self-signed, untrusted root, hostname mismatch)
      score -= 40;
    }
    if (ssl.trusted && !ssl.valid) {
      // Trusted cert but expired/invalid dates
      score -= 35;
    }
    if (ssl.valid && ssl.daysUntilExpiry !== null && ssl.daysUntilExpiry < 30) {
      score -= 5; // Expiring soon is minor
    }
    // No HSTS equivalent behavior: HTTP doesn't redirect to HTTPS
    if (ssl.httpToHttpsRedirect === false) {
      score -= 5; // Not redirecting HTTP to HTTPS
    }
  }

  // ===== Security header deductions (MODERATE PRIORITY) =====
  for (const header of headers) {
    // Skip special headers
    if (header.name === 'Server-Info-Exposure') {
      if (header.present) score -= 1; // Very low impact
      continue;
    }
    if (header.name === 'Cookie-Security') {
      if (header.present) score -= 2; // Low impact without knowing cookie type
      continue;
    }

    if (!header.present) {
      // Adjust deductions based on site context
      const isStaticNoAuth = context.isStaticSite && !context.hasLogin;

      switch (header.name) {
        case 'Content-Security-Policy':
          score -= isStaticNoAuth ? 5 : 10; // Less critical for static sites
          break;
        case 'Strict-Transport-Security':
          score -= ssl.enabled ? 10 : 3; // HSTS matters most when HTTPS is present
          break;
        case 'X-Frame-Options':
          score -= isStaticNoAuth ? 2 : 5;
          break;
        case 'X-Content-Type-Options':
          score -= 3;
          break;
        case 'Referrer-Policy':
          score -= 2;
          break;
        case 'Permissions-Policy':
          score -= 1;
          break;
        case 'X-XSS-Protection':
          score -= 1;
          break;
        default:
          score -= 2;
      }
    }
  }

  // ===== Port deductions (INFO ONLY — don't heavily penalize) =====
  for (const port of ports) {
    if (port.open) {
      // Only penalize genuinely risky services
      if (port.port === 21) score -= 5; // FTP is genuinely risky
      // Ports 80 and 443 are EXPECTED for web servers — no deduction
      // Port 22 (SSH) — minor concern but common, minimal deduction
      if (port.port === 22) score -= 1;
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

  return { score, riskLevel };
}

/**
 * Identify vulnerabilities with professional messaging and confidence levels.
 */
export function identifyVulnerabilities(
  headers: HeaderResult[],
  ssl: SSLResult,
  ports: PortResult[],
  context: SiteContext
): Vulnerability[] {
  const vulnerabilities: Vulnerability[] = [];
  const isStaticNoAuth = context.isStaticSite && !context.hasLogin;

  // ===== SSL/HTTPS vulnerabilities (HIGHEST PRIORITY — listed first) =====
  if (!ssl.enabled) {
    vulnerabilities.push({
      type: 'No HTTPS Encryption',
      severity: 'critical',
      description: 'The website does not use HTTPS. All data transmitted between the client and server is unencrypted and can be intercepted by third parties.',
      recommendation: 'Obtain an SSL/TLS certificate and configure your server to use HTTPS. Consider using Let\'s Encrypt for free certificates.',
      confidence: 'high',
    });
  } else if (!ssl.trusted) {
    // Determine specific issue
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
        recommendation: 'Renew the SSL certificate immediately. Set up automated renewal (e.g., certbot with cron) to prevent future expirations.';
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

  // ===== Header vulnerabilities (SECONDARY PRIORITY) =====
  for (const header of headers) {
    // Skip special headers handled separately
    if (header.name === 'Server-Info-Exposure' || header.name === 'Cookie-Security') {
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
              severity: 'high',
              description: 'No Strict-Transport-Security header detected. Without HSTS, browsers may access the site over HTTP before redirecting, exposing session cookies to interception.',
              recommendation: 'Add Strict-Transport-Security header (e.g., max-age=31536000; includeSubDomains) to enforce HTTPS connections.',
              confidence: header.confidence || 'high',
              confidenceNote: header.confidenceNote,
            });
          } else {
            // HSTS is irrelevant without HTTPS
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

  // ===== Port vulnerabilities (INFO ONLY — don't overstate) =====
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

  // ===== SSL/HTTPS suggestions (HIGHEST PRIORITY — shown first) =====
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

  // ===== Header suggestions (SECONDARY PRIORITY) =====
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
