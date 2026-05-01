import { HeaderResult } from './types';

const SECURITY_HEADERS = [
  {
    name: 'Content-Security-Policy',
    description: 'Prevents Cross-Site Scripting (XSS) and data injection attacks by specifying valid sources for content.',
    severity: 'critical' as const,
  },
  {
    name: 'Strict-Transport-Security',
    description: 'Forces browsers to always use HTTPS, preventing downgrade attacks and cookie hijacking.',
    severity: 'critical' as const,
  },
  {
    name: 'X-Frame-Options',
    description: 'Prevents clickjacking attacks by controlling whether a page can be embedded in frames.',
    severity: 'warning' as const,
  },
  {
    name: 'X-Content-Type-Options',
    description: 'Prevents MIME-type sniffing by forcing browsers to respect declared content types.',
    severity: 'warning' as const,
  },
  {
    name: 'Referrer-Policy',
    description: 'Controls how much referrer information is shared when navigating away from the page.',
    severity: 'info' as const,
  },
  {
    name: 'Permissions-Policy',
    description: 'Controls which browser features and APIs can be used in the browser (e.g., camera, microphone, geolocation).',
    severity: 'info' as const,
  },
  {
    name: 'X-XSS-Protection',
    description: 'Enables browser built-in XSS filter. Although deprecated in modern browsers, it provides legacy protection.',
    severity: 'info' as const,
  },
];

export async function checkHeaders(url: string): Promise<HeaderResult[]> {
  const results: HeaderResult[] = [];

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; SecurityAnalyzer/1.0)',
      },
    });

    clearTimeout(timeout);

    for (const header of SECURITY_HEADERS) {
      const value = response.headers.get(header.name.toLowerCase());
      results.push({
        name: header.name,
        present: value !== null && value !== '',
        value: value || null,
        description: header.description,
        severity: header.severity,
      });
    }

    // Check for server info exposure
    const serverHeader = response.headers.get('server');
    if (serverHeader) {
      results.push({
        name: 'Server-Info-Exposure',
        present: true, // present = exposed (bad)
        value: serverHeader,
        description: 'Server version information is exposed, which can help attackers identify vulnerabilities.',
        severity: 'warning',
      });
    } else {
      results.push({
        name: 'Server-Info-Exposure',
        present: false,
        value: null,
        description: 'Server version information is hidden (good practice).',
        severity: 'info',
      });
    }

    // Check for cookie security
    const setCookieHeaders = response.headers.getSetCookie?.() || [];
    if (setCookieHeaders.length > 0) {
      const insecureCookies = setCookieHeaders.filter(cookie => 
        !cookie.toLowerCase().includes('secure') || !cookie.toLowerCase().includes('httponly')
      );
      results.push({
        name: 'Cookie-Security',
        present: insecureCookies.length > 0,
        value: insecureCookies.length > 0 
          ? `${insecureCookies.length} cookie(s) missing Secure/HttpOnly flags`
          : 'All cookies have Secure and HttpOnly flags',
        description: 'Cookies without Secure and HttpOnly flags can be intercepted or accessed via JavaScript.',
        severity: insecureCookies.length > 0 ? 'warning' : 'info',
      });
    }

  } catch (error) {
    // If we can't connect, mark all headers as unknown
    for (const header of SECURITY_HEADERS) {
      results.push({
        name: header.name,
        present: false,
        value: null,
        description: header.description,
        severity: header.severity,
      });
    }
  }

  return results;
}
