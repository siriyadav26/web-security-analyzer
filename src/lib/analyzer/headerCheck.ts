import { HeaderResult, SiteContext, SiteType } from './types';
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

export async function checkHeaders(url: string): Promise<{
  headers: HeaderResult[];
  context: SiteContext;
  analysisMode: 'secure' | 'fallback';
}> {
  const results: HeaderResult[] = [];
  let responseBody: string | null = null;
  let responseContentType: string | null = null;
  let sslVerificationFailed = false;
  let analysisMode: 'secure' | 'fallback' = 'secure';

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

    // Try to get response body for context detection (limit to 50KB to avoid memory issues)
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
        responseBody = chunks.map(c => decoder.decode(c, { stream: true })).join('');
      } else {
        // Fallback: try text() but it's limited by stream above
        responseBody = null;
      }
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
      sslVerificationFailed = true;
      analysisMode = 'fallback';

      try {
        const insecureResponse = await fetchWithInsecureSSL(url);
        const headerResults = processResponseHeaders(insecureResponse, true);
        results.push(...headerResults);

        responseContentType = insecureResponse.headers.get('content-type');

        try {
          const reader = insecureResponse.body?.getReader();
          if (reader) {
            const chunks: Uint8Array[] = [];
            let totalSize = 0;
            const MAX_BODY_SIZE = 50000;
            while (totalSize < MAX_BODY_SIZE) {
              const { done, value } = await reader.read();
              if (done) break;
              chunks.push(value);
              totalSize += value.length;
            }
            reader.cancel().catch(() => {});
            const decoder = new TextDecoder();
            responseBody = chunks.map(c => decoder.decode(c, { stream: true })).join('');
          }
        } catch {
          // Can't read body
        }
      } catch {
        // Even insecure fetch failed — mark all as unreachable
        fillUnreachableHeaders(results);
        analysisMode = 'fallback';
      }
    } else {
      // Non-SSL error (timeout, DNS, etc.) — mark all as unreachable
      fillUnreachableHeaders(results);
      analysisMode = 'fallback';
    }
  }

  // Analyze site context from response body + content type
  const context = analyzeSiteContext(responseBody, responseContentType, sslVerificationFailed);

  // Adjust header severity and relevance based on context
  adjustSeverityForContext(results, context);

  return { headers: results, context, analysisMode };
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
 * 
 * Detection logic:
 * 1. API detection: JSON content type, or response is valid JSON, or URL path suggests API
 * 2. Auth detection: requires password field + form + login keywords (strict)
 * 3. Static detection: no forms, no login, no dynamic scripts
 * 4. Unknown: couldn't fetch content
 */
function analyzeSiteContext(
  body: string | null,
  contentType: string | null,
  sslVerificationFailed: boolean = false
): SiteContext {
  // If we couldn't fetch the body at all
  if (!body) {
    const note = sslVerificationFailed
      ? 'Could not fetch page content — SSL certificate verification failed. Context analysis is limited; classified as Unknown.'
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

  // === STEP 1: API DETECTION ===
  const isJsonContentType = contentType?.includes('application/json') || false;
  let isJsonBody = false;
  try {
    JSON.parse(body.substring(0, 10000)); // Only parse first 10K chars for performance
    isJsonBody = true;
  } catch {
    // Not JSON, that's fine
  }

  // Check URL for API patterns
  const urlPath = contentType !== null ? '' : ''; // We don't have URL here, use body heuristics
  const hasApiIndicators = lowerBody.includes('"endpoint"') ||
    lowerBody.includes('"status"') && lowerBody.includes('"data"') ||
    lowerBody.includes('"error"') && lowerBody.includes('"message"');

  const isApi = isJsonContentType || isJsonBody || hasApiIndicators;

  if (isApi) {
    const reasons: string[] = [];
    if (isJsonContentType) reasons.push('Response Content-Type is application/json');
    if (isJsonBody) reasons.push('Response body is valid JSON');
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
 * Adjust severity and relevance of headers based on site context.
 * 
 * Key rules:
 * - API endpoints: CSP, X-Frame-Options, X-XSS-Protection, Permissions-Policy are IRRELEVANT
 * - API endpoints: HSTS severity is reduced (no browser sessions to protect)
 * - Static sites: CSP, X-Frame severity reduced (no user input, no clickjacking risk)
 * - Interactive sites with auth: HSTS and CSP are critical
 */
function adjustSeverityForContext(headers: HeaderResult[], context: SiteContext): void {
  for (const header of headers) {
    if (header.present) continue; // Only adjust missing headers

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
          header.severity = 'warning';
          header.confidenceNote = 'HSTS ensures HTTPS is used for subsequent requests. For APIs consumed by other servers, this is less critical than for browser-facing sites, but still recommended if the API has any browser consumers.';
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
      if (header.name === 'Strict-Transport-Security') {
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
