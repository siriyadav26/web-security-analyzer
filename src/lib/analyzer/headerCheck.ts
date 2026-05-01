import { HeaderResult, SiteContext } from './types';

const SECURITY_HEADERS = [
  {
    name: 'Content-Security-Policy',
    description: 'Prevents Cross-Site Scripting (XSS) and data injection attacks by specifying valid sources for content.',
    severity: 'critical' as const,
    defaultConfidence: 'medium' as const,  // CSP can be applied dynamically
    dynamicNote: 'CSP header not detected in this response. It may be applied dynamically or via meta tags on specific routes.',
  },
  {
    name: 'Strict-Transport-Security',
    description: 'Forces browsers to always use HTTPS, preventing downgrade attacks and cookie hijacking.',
    severity: 'critical' as const,
    defaultConfidence: 'medium' as const,  // HSTS may be handled via preloading
    dynamicNote: 'No HSTS header detected. Note that some major sites use HSTS preloading instead of the header, which browsers respect equally.',
  },
  {
    name: 'X-Frame-Options',
    description: 'Prevents clickjacking attacks by controlling whether a page can be embedded in frames.',
    severity: 'warning' as const,
    defaultConfidence: 'high' as const,
    dynamicNote: undefined,
  },
  {
    name: 'X-Content-Type-Options',
    description: 'Prevents MIME-type sniffing by forcing browsers to respect declared content types.',
    severity: 'warning' as const,
    defaultConfidence: 'high' as const,
    dynamicNote: undefined,
  },
  {
    name: 'Referrer-Policy',
    description: 'Controls how much referrer information is shared when navigating away from the page.',
    severity: 'info' as const,
    defaultConfidence: 'high' as const,
    dynamicNote: undefined,
  },
  {
    name: 'Permissions-Policy',
    description: 'Controls which browser features and APIs can be used in the browser (e.g., camera, microphone, geolocation).',
    severity: 'info' as const,
    defaultConfidence: 'high' as const,
    dynamicNote: undefined,
  },
  {
    name: 'X-XSS-Protection',
    description: 'Enables browser built-in XSS filter. Deprecated in modern browsers; CSP is the preferred replacement.',
    severity: 'info' as const,
    defaultConfidence: 'high' as const,
    dynamicNote: undefined,
  },
];

export async function checkHeaders(url: string): Promise<{
  headers: HeaderResult[];
  context: SiteContext;
}> {
  const results: HeaderResult[] = [];
  let responseBody: string | null = null;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
      redirect: 'follow', // Follow redirects to check final response
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; SecurityAnalyzer/1.0)',
      },
    });

    clearTimeout(timeout);

    // Check security headers on the FINAL response (after redirects)
    for (const header of SECURITY_HEADERS) {
      const value = response.headers.get(header.name.toLowerCase());
      let isPresent = value !== null && value !== '';

      // Special handling for X-XSS-Protection: 0 means "disabled"
      // This is effectively the same as not having the header
      if (header.name === 'X-XSS-Protection' && value === '0') {
        isPresent = false; // Treat "0" as absent since it disables the filter
      }

      // Special handling for CSP: also check Content-Security-Policy-Report-Only
      let effectiveValue = value;
      let confidenceNote: string | undefined;

      if (header.name === 'Content-Security-Policy' && !isPresent) {
        const reportOnlyValue = response.headers.get('content-security-policy-report-only');
        if (reportOnlyValue) {
          // CSP-Report-Only exists — it monitors but doesn't enforce
          isPresent = true; // Consider it as partially present
          effectiveValue = `[Report-Only] ${reportOnlyValue.substring(0, 100)}...`;
          confidenceNote = 'CSP is set to report-only mode, which monitors violations but does not enforce the policy. Consider switching to enforcement mode.';
        }
      }

      results.push({
        name: header.name,
        present: isPresent,
        value: effectiveValue || null,
        description: header.description,
        severity: header.severity,
        confidence: isPresent ? 'high' : header.defaultConfidence,
        confidenceNote: !isPresent && header.dynamicNote ? header.dynamicNote : confidenceNote,
      });
    }

    // Check for server info exposure
    const serverHeader = response.headers.get('server');
    if (serverHeader) {
      results.push({
        name: 'Server-Info-Exposure',
        present: true, // present = exposed (bad)
        value: serverHeader,
        description: 'Server version information is exposed in HTTP headers.',
        severity: 'info', // Downgraded from warning - this is informational
        confidence: 'high',
        confidenceNote: 'Server header exposure alone is low risk. Version-specific vulnerabilities are required for exploitation.',
      });
    } else {
      results.push({
        name: 'Server-Info-Exposure',
        present: false,
        value: null,
        description: 'Server version information is hidden (good practice).',
        severity: 'info',
        confidence: 'high',
      });
    }

    // Check for cookie security
    const setCookieHeaders = response.headers.getSetCookie?.() || [];
    if (setCookieHeaders.length > 0) {
      // More nuanced cookie analysis: check each flag separately
      const cookiesMissingSecure = setCookieHeaders.filter(
        cookie => !cookie.toLowerCase().includes('secure')
      );
      const cookiesMissingHttpOnly = setCookieHeaders.filter(
        cookie => !cookie.toLowerCase().includes('httponly')
      );

      // Only flag as issue if session-like cookies are missing flags
      // Many cookies (preferences, analytics) don't need Secure/HttpOnly
      const hasInsecureCookies = cookiesMissingSecure.length > 0 || cookiesMissingHttpOnly.length > 0;

      results.push({
        name: 'Cookie-Security',
        present: hasInsecureCookies,
        value: hasInsecureCookies
          ? `${cookiesMissingSecure.length} cookie(s) missing Secure flag, ${cookiesMissingHttpOnly.length} missing HttpOnly flag`
          : 'All cookies have appropriate security flags',
        description: 'Cookies without Secure and HttpOnly flags can be intercepted or accessed via JavaScript.',
        severity: 'info', // Keep as info - we can't verify if these are session cookies
        confidence: hasInsecureCookies ? 'low' : 'high',
        confidenceNote: hasInsecureCookies
          ? 'Cookie flags were observed on the initial response. Some cookies (analytics, preferences) may not require Secure/HttpOnly flags. Session cookies should always have these flags.'
          : undefined,
      });
    }

    // Try to get response body for context detection
    try {
      responseBody = await response.text();
    } catch {
      // Can't read body, that's fine
    }

  } catch (error) {
    // If we can't connect, mark all headers as unknown with low confidence
    for (const header of SECURITY_HEADERS) {
      results.push({
        name: header.name,
        present: false,
        value: null,
        description: header.description,
        severity: header.severity,
        confidence: 'low',
        confidenceNote: 'Could not connect to the server to verify this header.',
      });
    }
  }

  // Analyze site context from response body
  const context = analyzeSiteContext(responseBody);

  // Adjust header severity based on context
  adjustSeverityForContext(results, context);

  return { headers: results, context };
}

/**
 * Analyze the site to determine its type and context.
 * This helps us provide more accurate severity assessments.
 */
function analyzeSiteContext(body: string | null): SiteContext {
  if (!body) {
    return {
      hasForms: false,
      hasLogin: false,
      isStaticSite: false,
      detectionNotes: 'Could not fetch page content for context analysis.',
    };
  }

  const lowerBody = body.toLowerCase();

  // Detect forms
  const hasForms = lowerBody.includes('<form') || lowerBody.includes('input type');

  // Detect login/auth
  const hasLogin = lowerBody.includes('password') ||
    lowerBody.includes('login') ||
    lowerBody.includes('signin') ||
    lowerBody.includes('sign-in') ||
    lowerBody.includes('auth') ||
    lowerBody.includes('session') ||
    lowerBody.includes('token');

  // Detect if likely static site
  const isStaticSite = !hasForms &&
    !hasLogin &&
    !lowerBody.includes('api') &&
    !lowerBody.includes('fetch(') &&
    !lowerBody.includes('xmlhttprequest') &&
    !lowerBody.includes('axios');

  const detectionNotes: string[] = [];
  if (hasForms) detectionNotes.push('Form elements detected');
  if (hasLogin) detectionNotes.push('Authentication-related content detected');
  if (isStaticSite) detectionNotes.push('Appears to be a static/informational site');
  if (detectionNotes.length === 0) detectionNotes.push('Dynamic site with possible interactive elements');

  return {
    hasForms,
    hasLogin,
    isStaticSite,
    detectionNotes: detectionNotes.join('. '),
  };
}

/**
 * Adjust severity of missing headers based on site context.
 * Static sites without forms/login have lower risk from missing headers.
 */
function adjustSeverityForContext(headers: HeaderResult[], context: SiteContext): void {
  for (const header of headers) {
    if (header.present) continue; // Only adjust missing headers

    // For static sites without auth, certain headers are less critical
    if (context.isStaticSite && !context.hasLogin) {
      switch (header.name) {
        case 'Content-Security-Policy':
          // Static sites with no forms are lower risk for XSS
          header.severity = 'warning';
          header.confidenceNote = header.confidenceNote ||
            'This appears to be a static site without user input, reducing XSS risk. However, CSP is still recommended as defense-in-depth.';
          break;
        case 'X-Frame-Options':
          // Clickjacking is less relevant for static content
          header.severity = 'info';
          header.confidenceNote = 'This appears to be a static site, reducing clickjacking risk.';
          break;
        case 'Cookie-Security':
          // Static sites typically don't have session cookies
          header.severity = 'info';
          break;
      }
    }

    // For sites with login, emphasize HSTS and CSP
    if (context.hasLogin) {
      if (header.name === 'Strict-Transport-Security') {
        header.confidenceNote = 'This site handles authentication. HSTS is critical to protect session cookies from being intercepted over HTTP.';
      }
      if (header.name === 'Content-Security-Policy') {
        header.confidenceNote = 'This site handles authentication. CSP is important to protect against credential-stealing XSS attacks.';
      }
    }
  }
}
