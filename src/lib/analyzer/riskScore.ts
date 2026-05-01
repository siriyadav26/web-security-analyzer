import { HeaderResult, SSLResult, PortResult, Vulnerability, SecuritySuggestion } from './types';

export function calculateRiskScore(
  headers: HeaderResult[],
  ssl: SSLResult,
  ports: PortResult[]
): { score: number; riskLevel: 'Low Risk' | 'Medium Risk' | 'High Risk' } {
  let score = 100;

  // Deduct points for missing security headers
  for (const header of headers) {
    if (header.name === 'Server-Info-Exposure') {
      if (header.present) score -= 5; // Server info exposed
      continue;
    }
    if (header.name === 'Cookie-Security') {
      if (header.present) score -= 5; // Insecure cookies
      continue;
    }
    if (!header.present) {
      switch (header.severity) {
        case 'critical':
          score -= 15;
          break;
        case 'warning':
          score -= 10;
          break;
        case 'info':
          score -= 5;
          break;
      }
    }
  }

  // SSL/TLS deductions
  if (!ssl.enabled) {
    score -= 25; // No HTTPS is a major issue
  } else {
    if (!ssl.valid) score -= 20; // Invalid certificate
    if (ssl.daysUntilExpiry !== null && ssl.daysUntilExpiry < 30) score -= 10; // Expiring soon
  }

  // Open ports deductions (only non-standard ports are concerning)
  for (const port of ports) {
    if (port.open) {
      if (port.port === 21) score -= 5; // FTP is insecure
      if (port.port === 22) score -= 3; // SSH exposed to internet
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

export function identifyVulnerabilities(
  headers: HeaderResult[],
  ssl: SSLResult,
  ports: PortResult[]
): Vulnerability[] {
  const vulnerabilities: Vulnerability[] = [];

  // Check for missing critical headers
  for (const header of headers) {
    if (header.name === 'Server-Info-Exposure') {
      if (header.present) {
        vulnerabilities.push({
          type: 'Information Disclosure',
          severity: 'medium',
          description: `Server version information (${header.value}) is exposed in HTTP headers.`,
          recommendation: 'Configure your web server to hide or obfuscate version information in the Server header.',
        });
      }
      continue;
    }

    if (header.name === 'Cookie-Security') {
      if (header.present) {
        vulnerabilities.push({
          type: 'Insecure Cookies',
          severity: 'medium',
          description: header.value || 'Cookies are missing Secure or HttpOnly flags.',
          recommendation: 'Set Secure and HttpOnly flags on all cookies to prevent interception and XSS-based cookie theft.',
        });
      }
      continue;
    }

    if (!header.present) {
      switch (header.name) {
        case 'Content-Security-Policy':
          vulnerabilities.push({
            type: 'Missing Content-Security-Policy',
            severity: 'high',
            description: 'No Content-Security-Policy header detected. This leaves the site vulnerable to XSS and code injection attacks.',
            recommendation: 'Implement a Content-Security-Policy header to restrict sources of executable scripts and other content.',
          });
          break;
        case 'Strict-Transport-Security':
          vulnerabilities.push({
            type: 'Missing HSTS',
            severity: 'high',
            description: 'No Strict-Transport-Security header detected. The site is vulnerable to protocol downgrade attacks and cookie hijacking.',
            recommendation: 'Add Strict-Transport-Security header (e.g., max-age=31536000; includeSubDomains) to enforce HTTPS.',
          });
          break;
        case 'X-Frame-Options':
          vulnerabilities.push({
            type: 'Clickjacking Vulnerability',
            severity: 'medium',
            description: 'No X-Frame-Options header detected. The site may be vulnerable to clickjacking attacks where malicious sites embed it in frames.',
            recommendation: 'Add X-Frame-Options header (DENY or SAMEORIGIN) or use Content-Security-Policy frame-ancestors directive.',
          });
          break;
        case 'X-Content-Type-Options':
          vulnerabilities.push({
            type: 'MIME Sniffing Risk',
            severity: 'medium',
            description: 'No X-Content-Type-Options header detected. Browsers may MIME-sniff responses, potentially executing malicious content.',
            recommendation: 'Add X-Content-Type-Options: nosniff header to prevent browsers from interpreting files as a different MIME type.',
          });
          break;
        case 'Referrer-Policy':
          vulnerabilities.push({
            type: 'Referrer Information Leak',
            severity: 'low',
            description: 'No Referrer-Policy header detected. URL parameters and paths may be leaked to third-party sites via the Referer header.',
            recommendation: 'Add Referrer-Policy header (e.g., strict-origin-when-cross-origin) to control referrer information sharing.',
          });
          break;
      }
    }
  }

  // SSL vulnerabilities
  if (!ssl.enabled) {
    vulnerabilities.push({
      type: 'No HTTPS',
      severity: 'critical',
      description: 'The website does not use HTTPS. All data transmitted between the client and server is unencrypted and can be intercepted.',
      recommendation: 'Obtain an SSL/TLS certificate and configure your server to use HTTPS. Consider using Let\'s Encrypt for free certificates.',
    });
  } else if (!ssl.valid) {
    vulnerabilities.push({
      type: 'Invalid SSL Certificate',
      severity: 'critical',
      description: 'The SSL certificate is invalid, expired, or self-signed. Browsers will warn users and may block access.',
      recommendation: 'Renew or replace the SSL certificate with a valid one from a trusted Certificate Authority.',
    });
  } else if (ssl.daysUntilExpiry !== null && ssl.daysUntilExpiry < 30) {
    vulnerabilities.push({
      type: 'SSL Certificate Expiring Soon',
      severity: 'medium',
      description: `The SSL certificate expires in ${ssl.daysUntilExpiry} days. An expired certificate will cause browser warnings and disrupt service.`,
      recommendation: 'Renew the SSL certificate before it expires to avoid service disruption.',
    });
  }

  // Port vulnerabilities
  for (const port of ports) {
    if (port.open) {
      if (port.port === 21) {
        vulnerabilities.push({
          type: 'FTP Port Open',
          severity: 'medium',
          description: 'FTP port (21) is open. FTP transmits credentials and data in plaintext, making it vulnerable to interception.',
          recommendation: 'Disable FTP if not needed, or replace it with SFTP or FTPS for encrypted file transfers.',
        });
      }
      if (port.port === 22) {
        vulnerabilities.push({
          type: 'SSH Port Exposed',
          severity: 'low',
          description: 'SSH port (22) is open and accessible from the internet. While SSH is encrypted, exposed SSH can be targeted for brute-force attacks.',
          recommendation: 'Restrict SSH access to specific IP ranges, use key-based authentication, and consider changing the default port.',
        });
      }
    }
  }

  return vulnerabilities;
}

export function generateSuggestions(
  headers: HeaderResult[],
  ssl: SSLResult,
  ports: PortResult[],
  vulnerabilities: Vulnerability[]
): SecuritySuggestion[] {
  const suggestions: SecuritySuggestion[] = [];

  // Header suggestions
  const missingCriticalHeaders = headers.filter(h => !h.present && h.severity === 'critical');
  if (missingCriticalHeaders.length > 0) {
    suggestions.push({
      category: 'Security Headers',
      priority: 'high',
      title: 'Implement Critical Security Headers',
      description: `Your website is missing ${missingCriticalHeaders.length} critical security header(s): ${missingCriticalHeaders.map(h => h.name).join(', ')}. These headers protect against XSS, clickjacking, and protocol downgrade attacks. Adding them is one of the most impactful security improvements you can make.`,
    });
  }

  const missingWarningHeaders = headers.filter(h => !h.present && h.severity === 'warning');
  if (missingWarningHeaders.length > 0) {
    suggestions.push({
      category: 'Security Headers',
      priority: 'medium',
      title: 'Add Warning-Level Security Headers',
      description: `Consider adding ${missingWarningHeaders.map(h => h.name).join(', ')} to further harden your website. While not as critical as CSP or HSTS, these headers provide important defense-in-depth protections against content-type confusion and clickjacking.`,
    });
  }

  // SSL suggestions
  if (!ssl.enabled) {
    suggestions.push({
      category: 'SSL/TLS',
      priority: 'high',
      title: 'Enable HTTPS Immediately',
      description: 'Your website does not use HTTPS encryption. This is a critical security gap that exposes all user data to interception. Obtain a free SSL certificate from Let\'s Encrypt and configure your web server to serve all traffic over HTTPS with proper redirects from HTTP.',
    });
  } else if (!ssl.valid) {
    suggestions.push({
      category: 'SSL/TLS',
      priority: 'high',
      title: 'Fix Your SSL Certificate',
      description: 'Your SSL certificate is invalid or expired. This causes browser warnings that erode user trust and can lead to users abandoning your site. Renew your certificate from a trusted Certificate Authority and ensure proper installation.',
    });
  } else if (ssl.daysUntilExpiry !== null && ssl.daysUntilExpiry < 90) {
    suggestions.push({
      category: 'SSL/TLS',
      priority: 'medium',
      title: 'Plan SSL Certificate Renewal',
      description: `Your SSL certificate expires in ${ssl.daysUntilExpiry} days. Set up automated renewal (e.g., certbot with cron) to avoid unexpected certificate expiration and service disruption.`,
    });
  }

  // Server info exposure suggestion
  const serverInfo = headers.find(h => h.name === 'Server-Info-Exposure');
  if (serverInfo?.present) {
    suggestions.push({
      category: 'Information Disclosure',
      priority: 'medium',
      title: 'Hide Server Version Information',
      description: `Your server is revealing version information: "${serverInfo.value}". Attackers can use this to identify known vulnerabilities specific to your server version. Configure your web server to suppress or obfuscate the Server header.`,
    });
  }

  // Cookie security suggestion
  const cookieSecurity = headers.find(h => h.name === 'Cookie-Security');
  if (cookieSecurity?.present) {
    suggestions.push({
      category: 'Cookie Security',
      priority: 'medium',
      title: 'Secure Your Cookies',
      description: 'Some cookies are missing Secure and/or HttpOnly flags. Without the Secure flag, cookies can be sent over unencrypted HTTP connections. Without HttpOnly, cookies are accessible to JavaScript, making them vulnerable to XSS-based session hijacking.',
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

  // General suggestions if score is not perfect
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
      description: 'Your website has a strong security posture. Continue to monitor for new vulnerabilities, keep your server software updated, and periodically review your security headers and SSL configuration to maintain this level of protection.',
    });
  }

  return suggestions;
}
