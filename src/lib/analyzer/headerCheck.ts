import { HeaderResult, SiteContext, SiteType, SSLResult } from './types';
import https from 'https';
import http from 'http';

const SECURITY_HEADERS = [
  {
    name: 'Content-Security-Policy',
    description: 'Prevents Cross-Site Scripting (XSS) and data injection attacks by specifying valid sources for content.',
    severity: 'critical' as const,
    defaultConfidence: 'medium' as const,
    dynamicNote: 'CSP header not detected in this response. It may be applied dynamically or via meta tags on specific routes.',
    relevantFor: ['static', 'interactive'] as SiteType[],  // NOT relevant for APIs
  },
  {
    name: 'Strict-Transport-Security',
    description: 'Forces browsers to always use HTTPS, preventing downgrade attacks and cookie hijacking.',
    severity: 'critical' as const,
    defaultConfidence: 'medium' as const,
    dynamicNote: 'No HSTS header detected. Note that some major sites use HSTS preloading instead of the header, which browsers respect equally.',
    relevantFor: ['static', 'interactive', 'api'] as SiteType[],  // Relevant for all
  },
  {
    name: 'X-Frame-Options',
    description: 'Prevents clickjacking attacks by controlling whether a page can be embedded in frames.',
    severity: 'warning' as const,
    defaultConfidence: 'high' as const,
    dynamicNote: undefined,
    relevantFor: ['static', 'interactive'] as SiteType[],  // NOT relevant for APIs
  },
  {
    name: 'X-Content-Type-Options',
    description: 'Prevents MIME-type sniffing by forcing browsers to respect declared content types.',
    severity: 'warning' as const,
    defaultConfidence: 'high' as const,
    dynamicNote: undefined,
    relevantFor: ['static', 'interactive', 'api'] as SiteType[],
  },
  {
    name: 'Referrer-Policy',
    description: 'Controls how much referrer information is shared when navigating away from the page.',
    severity: 'info' as const,
    defaultConfidence: 'high' as const,
    dynamicNote: undefined,
    relevantFor: ['static', 'interactive'] as SiteType[],  // Less relevant for APIs
  },
  {
    name: 'Permissions-Policy',
    description: 'Controls which browser features and APIs can be used in the browser (e.g., camera, microphone, geolocation).',
    severity: 'info' as const,
    defaultConfidence: 'high' as const,
    dynamicNote: undefined,
    relevantFor: ['interactive'] as SiteType[],  // Only relevant for interactive apps
  },
  {
    name: 'X-XSS-Protection',
    description: 'Enables browser built-in XSS filter. Deprecated in modern browsers; CSP is the preferred replacement.',
    severity: 'info' as const,
    defaultConfidence: 'high' as const,
    dynamicNote: undefined,
    relevantFor: ['static', 'interactive'] as SiteType[],  // NOT relevant for APIs
  },
];

export async function checkHeaders(url: string, sslResult?: SSLResult): Promise<{
  headers: HeaderResult[];
  context: SiteContext;
  analysisMode: 'secure' | 'fallback';
}> {
  const results: HeaderResult[] = [];
  let responseBody: string | null = null;
  let responseContentType: string | null = null;
  let sslVerificationFailed = false;
  let usedHttpFallback = false;
  let analysisMode: 'secure' | 'fallback' = 'secure';

  // === STEP 1: Try HTTPS fetch first ===
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

    // Get content type for API detection
    responseContentType = response.headers.get('content-type');

    // Try to get response body for context detection (limit to 50KB)
    responseBody = await readResponseBody(response);

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
      sslVerificationFailed = true;
      analysisMode = 'fallback';

      // Try insecure HTTPS first
      try {
        const insecureResponse = await fetchWithInsecureSSL(url);
        const headerResults = processResponseHeaders(insecureResponse, true);
        results.push(...headerResults);

        responseContentType = insecureResponse.headers.get('content-type');
        responseBody = await readResponseBody(insecureResponse);
      } catch {
        // Insecure HTTPS also failed — try HTTP fallback
        const httpResult = await tryHttpFallback(url);
        if (httpResult) {
          usedHttpFallback = true;
          results.push(...httpResult.headers);
          responseContentType = httpResult.contentType;
          responseBody = httpResult.body;
        } else {
          // Even HTTP failed — mark all as unreachable
          fillUnreachableHeaders(results);
          analysisMode = 'fallback';
        }
      }
    } else {
      // Non-SSL error (timeout, DNS, connection refused) — try HTTP fallback
      const httpResult = await tryHttpFallback(url);
      if (httpResult) {
        usedHttpFallback = true;
        analysisMode = 'fallback';
        results.push(...httpResult.headers);
        responseContentType = httpResult.contentType;
        responseBody = httpResult.body;
      } else {
        // Even HTTP failed — mark all as unreachable
        fillUnreachableHeaders(results);
        analysisMode = 'fallback';
      }
    }
  }

  // === POST-CHECK: If we still don't have body for context, try HTTP just for context ===
  // This handles cases like neverssl.com where insecure HTTPS gives headers but no useful body
  if (!responseBody) {
    try {
      const httpUrl = url.replace(/^https:\/\//, 'http://');
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);

      const httpResp = await fetch(httpUrl, {
        method: 'GET',
        signal: controller.signal,
        redirect: 'follow',
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; SecurityAnalyzer/1.0)',
        },
      });

      clearTimeout(timeout);
      responseContentType = responseContentType || httpResp.headers.get('content-type');
      responseBody = await readResponseBody(httpResp);

      // If we also didn't get headers before, try from this HTTP response
      if (results.length === 0) {
        const headerResults = processResponseHeaders(httpResp, false, true);
        results.push(...headerResults);
        analysisMode = 'fallback';
      }
    } catch {
      // HTTP also failed for context — keep going with what we have
    }
  }

  // Analyze site context from response body + content type
  const context = analyzeSiteContext(responseBody, responseContentType, url, sslVerificationFailed || usedHttpFallback);

  // Adjust header severity and relevance based on context AND SSL status
  adjustSeverityForContext(results, context, sslResult);

  return { headers: results, context, analysisMode };
}

/**
 * Read response body (limit to 50KB) for context analysis.
 */
async function readResponseBody(response: Response): Promise<string | null> {
  try {
    const reader = response.body?.getReader();
    if (reader) {
      const chunks: Uint8Array[] = [];
      let totalSize = 0;
      const MAX_BODY_SIZE = 50000; // 50KB limit for context analysis
      while (totalSize < MAX_BODY_SIZE) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        totalSize += value.length;
      }
      reader.cancel().catch(() => {});
      const decoder = new TextDecoder();
      return chunks.map(c => decoder.decode(c, { stream: true })).join('');
    }
  } catch {
    // Can't read body, that's fine
  }
  return null;
}

/**
 * HTTP Fallback: When HTTPS fails entirely, try plain HTTP to get headers and context.
 * This is critical for HTTP-only sites like neverssl.com.
 */
async function tryHttpFallback(originalUrl: string): Promise<{
  headers: HeaderResult[];
  contentType: string | null;
  body: string | null;
} | null> {
  try {
    // Convert URL to HTTP
    const httpUrl = originalUrl.replace(/^https:\/\//, 'http://');

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(httpUrl, {
      method: 'GET',
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; SecurityAnalyzer/1.0)',
      },
    });

    clearTimeout(timeout);

    const headerResults = processResponseHeaders(response, false, true); // isHttpFallback=true
    const contentType = response.headers.get('content-type');
    const body = await readResponseBody(response);

    return { headers: headerResults, contentType, body };
  } catch {
    return null;
  }
}

/**
 * Fetch URL with SSL verification disabled.
 */
async function fetchWithInsecureSSL(url: string): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
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
    return fetchWithHttpsModule(url);
  }
}

/**
 * Fallback: Use http/https module directly to fetch headers when
 * the standard fetch doesn't support insecure connections.
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
      if ([301, 302, 303, 307, 308].includes(res.statusCode || 0) && res.headers.location) {
        let redirectUrl = res.headers.location;
        if (redirectUrl.startsWith('/')) {
          redirectUrl = `${parsedUrl.protocol}//${parsedUrl.host}${redirectUrl}`;
        }
        res.resume();
        fetchWithHttpsModule(redirectUrl, maxRedirects - 1).then(resolve).catch(reject);
        return;
      }

      let body = '';
      res.on('data', (chunk: Buffer | string) => { body += chunk; });
      res.on('end', () => {
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
 */
function processResponseHeaders(response: Response, isSSLBypass: boolean = false, isHttpFallback: boolean = false): HeaderResult[] {
  const results: HeaderResult[] = [];
  const connectionNote = isSSLBypass
    ? ' (verified over insecure connection due to SSL certificate issues)'
    : isHttpFallback
    ? ' (fetched via HTTP fallback — HTTPS unavailable)'
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

    // Add connection note if applicable
    if ((isSSLBypass || isHttpFallback) && !isPresent && !confidenceNote) {
      confidenceNote = header.dynamicNote || undefined;
    }

    // HSTS is irrelevant when fetched via HTTP (it's an HTTPS-only header)
    if (header.name === 'Strict-Transport-Security' && isHttpFallback) {
      isPresent = false;
      confidenceNote = 'HSTS was not detected. Note: HSTS can only be served over HTTPS connections — this site was fetched via HTTP fallback.';
    }

    results.push({
      name: header.name,
      present: isPresent,
      value: effectiveValue || null,
      description: header.description,
      severity: header.severity,
      confidence: isPresent ? ((isSSLBypass || isHttpFallback) ? 'medium' : 'high') : header.defaultConfidence,
      confidenceNote: !isPresent && confidenceNote ? confidenceNote + connectionNote : 
                      (isSSLBypass || isHttpFallback) && isPresent ? `Verified over ${isSSLBypass ? 'connection with SSL certificate issues' : 'HTTP fallback'}.` : confidenceNote,
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
      confidence: (isSSLBypass || isHttpFallback) ? 'medium' : 'high',
      confidenceNote: 'Server header exposure alone is low risk. Version-specific vulnerabilities are required for exploitation.',
    });
  } else {
    results.push({
      name: 'Server-Info-Exposure',
      present: false,
      value: null,
      description: 'Server version information is hidden (good practice).',
      severity: 'info',
      confidence: (isSSLBypass || isHttpFallback) ? 'medium' : 'high',
    });
  }

  // Check for cookie security — only flag session-related cookies
  const setCookieHeaders = response.headers.getSetCookie?.() || [];
  if (setCookieHeaders.length > 0) {
    // Only flag cookies that look like session identifiers
    const sessionCookiePatterns = /session|sess|token|auth|login|sid|jsession|phpsessid|asp\.net|csrf|xsrf/i;
    
    const sessionCookies = setCookieHeaders.filter(cookie => {
      const cookieName = cookie.split('=')[0].trim();
      return sessionCookiePatterns.test(cookieName);
    });

    const nonSessionCookies = setCookieHeaders.filter(cookie => {
      const cookieName = cookie.split('=')[0].trim();
      return !sessionCookiePatterns.test(cookieName);
    });

    // Only flag session cookies missing security flags
    const sessionMissingSecure = sessionCookies.filter(
      cookie => !cookie.toLowerCase().includes('secure')
    );
    const sessionMissingHttpOnly = sessionCookies.filter(
      cookie => !cookie.toLowerCase().includes('httponly')
    );

    // Non-session cookies (analytics, preferences) missing flags — low priority
    const nonSessionMissingSecure = nonSessionCookies.filter(
      cookie => !cookie.toLowerCase().includes('secure')
    );
    const nonSessionMissingHttpOnly = nonSessionCookies.filter(
      cookie => !cookie.toLowerCase().includes('httponly')
    );

    const hasInsecureSessionCookies = sessionMissingSecure.length > 0 || sessionMissingHttpOnly.length > 0;
    const hasInsecureNonSessionCookies = nonSessionMissingSecure.length > 0 || nonSessionMissingHttpOnly.length > 0;

    const hasAnyInsecureCookies = hasInsecureSessionCookies || hasInsecureNonSessionCookies;

    results.push({
      name: 'Cookie-Security',
      present: hasAnyInsecureCookies,
      value: hasAnyInsecureCookies
        ? hasInsecureSessionCookies
          ? `${sessionMissingSecure.length} session cookie(s) missing Secure flag, ${sessionMissingHttpOnly.length} missing HttpOnly flag`
          : `${nonSessionMissingSecure.length} non-session cookie(s) missing Secure flag, ${nonSessionMissingHttpOnly.length} missing HttpOnly flag`
        : 'All cookies have appropriate security flags',
      description: 'Session cookies without Secure and HttpOnly flags can be intercepted or accessed via JavaScript.',
      severity: hasInsecureSessionCookies ? 'warning' : 'info',
      confidence: hasAnyInsecureCookies ? 'low' : ((isSSLBypass || isHttpFallback) ? 'medium' : 'high'),
      confidenceNote: hasInsecureSessionCookies
        ? 'Session/authentication cookies are missing security flags. This is a real risk — these cookies should have Secure and HttpOnly flags.'
        : hasInsecureNonSessionCookies
        ? 'Only non-session cookies (analytics, preferences) are missing security flags. These are lower risk than session cookies.'
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
 * 
 * Detection logic (priority order):
 * 1. API detection: JSON content type, valid JSON body, URL API patterns, or API service indicators in HTML
 * 2. Auth detection: requires password field + form + login keywords (strict)
 * 3. Static detection: no forms, no login, no dynamic scripts
 * 4. Unknown: couldn't fetch content
 */
function analyzeSiteContext(
  body: string | null,
  contentType: string | null,
  url: string,
  isFallbackMode: boolean = false
): SiteContext {
  // If we couldn't fetch the body at all
  if (!body) {
    const note = isFallbackMode
      ? 'Could not fetch page content — connection issues prevented content analysis. Context analysis is limited; classified as Unknown.'
      : 'Could not fetch page content for context analysis. Classified as Unknown.';
    return {
      siteType: 'unknown',
      hasForms: false,
      hasLogin: false,
      isStaticSite: false,
      isApi: false,
      detectionNotes: note,
    };
  }

  const lowerBody = body.toLowerCase();

  // === STEP 1: API DETECTION (HIGHEST PRIORITY) ===
  const isJsonContentType = contentType?.includes('application/json') || false;
  let isJsonBody = false;
  try {
    JSON.parse(body.substring(0, 10000)); // Only parse first 10K chars for performance
    isJsonBody = true;
  } catch {
    // Not JSON, that's fine
  }

  // Check URL for API patterns
  let urlPath = '';
  try {
    const parsedUrl = new URL(url);
    urlPath = parsedUrl.pathname.toLowerCase();
  } catch {
    // URL parse failed
  }

  const hasApiUrlPattern = /\/api\/|\/v1\/|\/v2\/|\/v3\/|\/rest\/|\/graphql|\/json|\/endpoint/i.test(urlPath);

  // Check for API service indicators in HTML body (for API testing services like jsonplaceholder, httpbin)
  const hasApiServiceIndicators = lowerBody.includes('rest api') ||
    lowerBody.includes('api endpoint') ||
    lowerBody.includes('api service') ||
    lowerBody.includes('json api') ||
    lowerBody.includes('http request') && lowerBody.includes('response service') ||
    lowerBody.includes('fake rest api') ||
    lowerBody.includes('api testing') ||
    lowerBody.includes('free api') ||
    lowerBody.includes('placeholder') && lowerBody.includes('api') ||
    lowerBody.includes('swagger') ||
    lowerBody.includes('openapi');

  // Check for API-style JSON structures in body
  const hasApiIndicators = lowerBody.includes('"endpoint"') ||
    (lowerBody.includes('"status"') && lowerBody.includes('"data"')) ||
    (lowerBody.includes('"error"') && lowerBody.includes('"message"'));

  const isApi = isJsonContentType || isJsonBody || hasApiUrlPattern || hasApiServiceIndicators || hasApiIndicators;

  if (isApi) {
    const reasons: string[] = [];
    if (isJsonContentType) reasons.push('Response Content-Type is application/json');
    if (isJsonBody) reasons.push('Response body is valid JSON');
    if (hasApiUrlPattern) reasons.push('URL path suggests API endpoint');
    if (hasApiServiceIndicators) reasons.push('Page describes API/service functionality');
    if (hasApiIndicators) reasons.push('Response contains API-style structure');

    return {
      siteType: 'api',
      hasForms: false,
      hasLogin: false,
      isStaticSite: false,
      isApi: true,
      detectionNotes: `Identified as API endpoint. ${reasons.join('. ')}. Security header requirements differ from web applications — browser-specific headers like CSP and X-Frame-Options are not applicable.`,
    };
  }

  // === STEP 2: FORM & AUTH DETECTION (STRICT) ===
  // Auth detection is STRICT: requires actual form with password field + login keywords
  const hasForms = lowerBody.includes('<form') || lowerBody.includes('input type');

  // STRICT auth: must have a password input field AND a form AND login-related context
  const hasPasswordField = lowerBody.includes('type="password"') || lowerBody.includes("type='password'");
  const hasLoginKeywords = lowerBody.includes('login') ||
    lowerBody.includes('signin') ||
    lowerBody.includes('sign-in') ||
    lowerBody.includes('log in') ||
    lowerBody.includes('authenticate');

  // Auth is only true if we have ALL three: password field + form + login keywords
  const hasLogin = hasPasswordField && hasForms && hasLoginKeywords;

  // If we have login keywords but no password field, mark with a note
  const hasWeakLoginSignal = !hasLogin && (hasLoginKeywords || lowerBody.includes('auth') || lowerBody.includes('session') || lowerBody.includes('token'));

  // === STEP 3: STATIC VS INTERACTIVE ===
  const hasDynamicContent = lowerBody.includes('fetch(') ||
    lowerBody.includes('xmlhttprequest') ||
    lowerBody.includes('axios') ||
    lowerBody.includes('<form') ||
    lowerBody.includes('onclick') ||
    lowerBody.includes('addeventlistener');

  const isStaticSite = !hasForms && !hasLogin && !hasDynamicContent;

  // === STEP 4: DETERMINE SITE TYPE ===
  let siteType: SiteType;
  const detectionNotes: string[] = [];

  if (hasLogin) {
    siteType = 'interactive';
    detectionNotes.push('Authentication form detected (password field + login keywords + form element)');
  } else if (hasForms) {
    siteType = 'interactive';
    detectionNotes.push('Form elements detected — site accepts user input');
  } else if (isStaticSite) {
    siteType = 'static';
    detectionNotes.push('Appears to be a static/informational site — no forms, login, or dynamic content detected');
  } else if (hasDynamicContent) {
    siteType = 'interactive';
    detectionNotes.push('Dynamic/interactive content detected');
  } else {
    siteType = 'static';
    detectionNotes.push('No interactive elements detected');
  }

  if (hasWeakLoginSignal) {
    detectionNotes.push('Some authentication-related keywords detected but no confirmed login form — treating as non-auth site');
  }

  if (detectionNotes.length === 0) {
    detectionNotes.push('Unable to determine site characteristics precisely');
  }

  return {
    siteType,
    hasForms,
    hasLogin,
    isStaticSite,
    isApi: false,
    detectionNotes: detectionNotes.join('. '),
  };
}

/**
 * Adjust severity and relevance of headers based on site context AND SSL status.
 * 
 * Key rules:
 * - API endpoints: CSP, X-Frame-Options, X-XSS-Protection, Permissions-Policy, Referrer-Policy are IRRELEVANT
 * - API endpoints: HSTS severity is reduced (no browser sessions to protect)
 * - Untrusted HTTPS: HSTS is irrelevant (nothing to enforce)
 * - Static sites: CSP, X-Frame severity reduced (no user input, no clickjacking risk)
 * - Interactive sites with auth: HSTS and CSP are critical
 */
function adjustSeverityForContext(headers: HeaderResult[], context: SiteContext, sslResult?: SSLResult): void {
  const hasUntrustedHTTPS = sslResult ? (!sslResult.enabled && sslResult.protocol !== null) : false;

  for (const header of headers) {
    if (header.present) continue; // Only adjust missing headers

    // === HSTS IRRELEVANT WHEN HTTPS IS UNTRUSTED ===
    if (header.name === 'Strict-Transport-Security' && hasUntrustedHTTPS) {
      header.severity = 'irrelevant';
      header.confidenceNote = 'HSTS is only effective over trusted HTTPS. Since this site\'s SSL certificate is not trusted by browsers, HSTS would have no effect — address the certificate issue first.';
      continue;
    }

    // === API-SPECIFIC ADJUSTMENTS ===
    if (context.isApi || context.siteType === 'api') {
      switch (header.name) {
        case 'Content-Security-Policy':
          header.severity = 'irrelevant';
          header.confidenceNote = 'CSP is a browser-side protection and does not apply to API endpoints. API consumers (other servers, apps) do not execute scripts or load resources from this response.';
          break;
        case 'X-Frame-Options':
          header.severity = 'irrelevant';
          header.confidenceNote = 'X-Frame-Options protects against clickjacking in browsers. API responses are not rendered in frames and are not vulnerable to this attack.';
          break;
        case 'X-XSS-Protection':
          header.severity = 'irrelevant';
          header.confidenceNote = 'XSS protection is a browser feature. API responses consumed by other servers or applications are not vulnerable to XSS.';
          break;
        case 'Permissions-Policy':
          header.severity = 'irrelevant';
          header.confidenceNote = 'Permissions-Policy controls browser features (camera, microphone, etc.). Not applicable to API endpoints.';
          break;
        case 'Strict-Transport-Security':
          if (!hasUntrustedHTTPS) {
            header.severity = 'warning';
            header.confidenceNote = 'HSTS ensures HTTPS is used for subsequent requests. For APIs consumed by other servers, this is less critical than for browser-facing sites, but still recommended if the API has any browser consumers.';
          }
          break;
        case 'Referrer-Policy':
          header.severity = 'irrelevant';
          header.confidenceNote = 'Referrer-Policy controls browser referrer headers. Not applicable to API endpoints.';
          break;
      }
      continue;
    }

    // === STATIC SITE ADJUSTMENTS ===
    if (context.siteType === 'static' && !context.hasLogin) {
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
        case 'Permissions-Policy':
          header.severity = 'info';
          header.confidenceNote = 'Permissions-Policy is most relevant for interactive applications that use browser features.';
          break;
        case 'Cookie-Security':
          header.severity = 'info';
          break;
      }
    }

    // === INTERACTIVE SITE WITH AUTH — EMPHASIZE CRITICAL HEADERS ===
    if (context.hasLogin) {
      if (header.name === 'Strict-Transport-Security' && !hasUntrustedHTTPS) {
        header.severity = 'critical';
        header.confidenceNote = 'This site handles authentication. HSTS is critical to protect session cookies from being intercepted over HTTP.';
      }
      if (header.name === 'Content-Security-Policy') {
        header.severity = 'critical';
        header.confidenceNote = 'This site handles authentication. CSP is important to protect against credential-stealing XSS attacks.';
      }
    }
  }
}
