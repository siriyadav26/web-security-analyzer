import { HeaderResult, SiteContext } from './types';
import https from 'https';
import http from 'http';

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
  let sslVerificationFailed = false;

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

    // Check security headers on the FINAL response (after redirects)
    const headerResults = processResponseHeaders(response);
    results.push(...headerResults);

    // Try to get response body for context detection
    try {
      responseBody = await response.text();
    } catch {
      // Can't read body, that's fine
    }

  } catch (error: any) {
    const errorMsg = error?.cause?.code || error?.code || error?.message || '';

    // Check if the error is due to SSL certificate verification failure
    const isSSLError = errorMsg.includes('CERT') ||
      errorMsg.includes('certificate') ||
      errorMsg.includes('SSL') ||
      errorMsg.includes('TLS') ||
      errorMsg.includes('UNABLE_TO_VERIFY_LEAF_SIGNATURE') ||
      errorMsg.includes('SELF_SIGNED_CERT') ||
      errorMsg.includes('ERR_TLS_CERT_ALTNAME_INVALID') ||
      (error?.cause?.message && (
        error.cause.message.includes('certificate') ||
        error.cause.message.includes('CERT')
      ));

    if (isSSLError) {
      // SSL verification failed — retry with verification disabled
      // This allows us to still check headers even on sites with invalid certs
      sslVerificationFailed = true;

      try {
        const insecureResponse = await fetchWithInsecureSSL(url);
        const headerResults = processResponseHeaders(insecureResponse, true);
        results.push(...headerResults);

        try {
          responseBody = await insecureResponse.text();
        } catch {
          // Can't read body
        }
      } catch {
        // Even insecure fetch failed — mark all as unreachable
        fillUnreachableHeaders(results);
      }
    } else {
      // Non-SSL error (timeout, DNS, etc.) — mark all as unreachable
      fillUnreachableHeaders(results);
    }
  }

  // Analyze site context from response body
  const context = analyzeSiteContext(responseBody, sslVerificationFailed);

  // Adjust header severity based on context
  adjustSeverityForContext(results, context);

  return { headers: results, context };
}

/**
 * Fetch URL with SSL verification disabled.
 * Used as a fallback when the initial fetch fails due to certificate errors.
 */
async function fetchWithInsecureSSL(url: string): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    // Create a custom https agent that doesn't verify certificates
    const agent = new https.Agent({
      rejectUnauthorized: false,
    });

    // Use dynamic import to access Node.js specific fetch options
    const response = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; SecurityAnalyzer/1.0)',
      },
      // @ts-ignore - dispatcher is undici-specific for Node.js fetch
      dispatcher: undefined,
    });

    clearTimeout(timeout);
    return response;
  } catch (error) {
    clearTimeout(timeout);

    // If the custom agent approach doesn't work with fetch,
    // fall back to using https.get directly
    return fetchWithHttpsModule(url);
  }
}

/**
 * Fallback: Use http/https module directly to fetch headers when
 * the standard fetch doesn't support insecure connections.
 * Handles both HTTP and HTTPS URLs and follows redirects.
 */
function fetchWithHttpsModule(url: string, maxRedirects: number = 5): Promise<Response> {
  return new Promise((resolve, reject) => {
    if (maxRedirects <= 0) {
      reject(new Error('Too many redirects'));
      return;
    }

    const parsedUrl = new URL(url);
    const isHttps = parsedUrl.protocol === 'https:';
    const httpModule = isHttps ? https : http;

    const options: https.RequestOptions = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (isHttps ? 443 : 80),
      path: parsedUrl.pathname + parsedUrl.search,
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; SecurityAnalyzer/1.0)',
      },
      ...(isHttps ? { rejectUnauthorized: false } : {}),
    };

    const req = httpModule.request(options, (res) => {
      // Handle redirects manually
      if ([301, 302, 303, 307, 308].includes(res.statusCode || 0) && res.headers.location) {
        let redirectUrl = res.headers.location;
        if (redirectUrl.startsWith('/')) {
          redirectUrl = `${parsedUrl.protocol}//${parsedUrl.host}${redirectUrl}`;
        }
        // Consume the response body to free the connection
        res.resume();
        // Follow redirect
        fetchWithHttpsModule(redirectUrl, maxRedirects - 1).then(resolve).catch(reject);
        return;
      }

      // Collect response body
      let body = '';
      res.on('data', (chunk: Buffer | string) => { body += chunk; });
      res.on('end', () => {
        // Create a Response-like object from the http response
        const response = new Response(body, {
          status: res.statusCode || 200,
          statusText: res.statusMessage || '',
          headers: res.headers as Record<string, string>,
        });
        resolve(response);
      });
    });

    req.on('error', reject);
    req.setTimeout(15000, () => {
      req.destroy();
      reject(new Error('Request timed out'));
    });
    req.end();
  });
}

/**
 * Process response headers and create HeaderResult array.
 * Shared between secure and insecure fetch paths.
 */
function processResponseHeaders(response: Response, isSSLBypass: boolean = false): HeaderResult[] {
  const results: HeaderResult[] = [];
  const sslNote = isSSLBypass
    ? ' (verified over insecure connection due to SSL certificate issues)'
    : '';

  for (const header of SECURITY_HEADERS) {
    const value = response.headers.get(header.name.toLowerCase());
    let isPresent = value !== null && value !== '';

    // Special handling for X-XSS-Protection: 0 means "disabled"
    if (header.name === 'X-XSS-Protection' && value === '0') {
      isPresent = false;
    }

    // Special handling for CSP: also check Content-Security-Policy-Report-Only
    let effectiveValue = value;
    let confidenceNote: string | undefined;

    if (header.name === 'Content-Security-Policy' && !isPresent) {
      const reportOnlyValue = response.headers.get('content-security-policy-report-only');
      if (reportOnlyValue) {
        isPresent = true;
        effectiveValue = `[Report-Only] ${reportOnlyValue.substring(0, 100)}...`;
        confidenceNote = 'CSP is set to report-only mode, which monitors violations but does not enforce the policy. Consider switching to enforcement mode.';
      }
    }

    // Add SSL bypass note if applicable
    if (isSSLBypass && !isPresent && !confidenceNote) {
      confidenceNote = header.dynamicNote || undefined;
    }

    results.push({
      name: header.name,
      present: isPresent,
      value: effectiveValue || null,
      description: header.description,
      severity: header.severity,
      confidence: isPresent ? (isSSLBypass ? 'medium' : 'high') : header.defaultConfidence,
      confidenceNote: !isPresent && confidenceNote ? confidenceNote + sslNote : 
                      isSSLBypass && isPresent ? 'Verified over connection with SSL certificate issues.' : confidenceNote,
    });
  }

  // Check for server info exposure
  const serverHeader = response.headers.get('server');
  if (serverHeader) {
    results.push({
      name: 'Server-Info-Exposure',
      present: true,
      value: serverHeader,
      description: 'Server version information is exposed in HTTP headers.',
      severity: 'info',
      confidence: isSSLBypass ? 'medium' : 'high',
      confidenceNote: 'Server header exposure alone is low risk. Version-specific vulnerabilities are required for exploitation.',
    });
  } else {
    results.push({
      name: 'Server-Info-Exposure',
      present: false,
      value: null,
      description: 'Server version information is hidden (good practice).',
      severity: 'info',
      confidence: isSSLBypass ? 'medium' : 'high',
    });
  }

  // Check for cookie security
  const setCookieHeaders = response.headers.getSetCookie?.() || [];
  if (setCookieHeaders.length > 0) {
    const cookiesMissingSecure = setCookieHeaders.filter(
      cookie => !cookie.toLowerCase().includes('secure')
    );
    const cookiesMissingHttpOnly = setCookieHeaders.filter(
      cookie => !cookie.toLowerCase().includes('httponly')
    );

    const hasInsecureCookies = cookiesMissingSecure.length > 0 || cookiesMissingHttpOnly.length > 0;

    results.push({
      name: 'Cookie-Security',
      present: hasInsecureCookies,
      value: hasInsecureCookies
        ? `${cookiesMissingSecure.length} cookie(s) missing Secure flag, ${cookiesMissingHttpOnly.length} missing HttpOnly flag`
        : 'All cookies have appropriate security flags',
      description: 'Cookies without Secure and HttpOnly flags can be intercepted or accessed via JavaScript.',
      severity: 'info',
      confidence: hasInsecureCookies ? 'low' : (isSSLBypass ? 'medium' : 'high'),
      confidenceNote: hasInsecureCookies
        ? 'Cookie flags were observed on the initial response. Some cookies (analytics, preferences) may not require Secure/HttpOnly flags. Session cookies should always have these flags.'
        : undefined,
    });
  }

  return results;
}

/**
 * Fill header results for unreachable servers.
 */
function fillUnreachableHeaders(results: HeaderResult[]): void {
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

/**
 * Analyze the site to determine its type and context.
 * This helps us provide more accurate severity assessments.
 */
function analyzeSiteContext(body: string | null, sslVerificationFailed: boolean = false): SiteContext {
  if (!body) {
    const note = sslVerificationFailed
      ? 'Could not fetch page content — SSL certificate verification failed. Context analysis is limited.'
      : 'Could not fetch page content for context analysis.';
    return {
      hasForms: false,
      hasLogin: false,
      isStaticSite: false,
      detectionNotes: note,
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
          header.severity = 'warning';
          header.confidenceNote = header.confidenceNote ||
            'This appears to be a static site without user input, reducing XSS risk. However, CSP is still recommended as defense-in-depth.';
          break;
        case 'X-Frame-Options':
          header.severity = 'info';
          header.confidenceNote = 'This appears to be a static site, reducing clickjacking risk.';
          break;
        case 'Cookie-Security':
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
