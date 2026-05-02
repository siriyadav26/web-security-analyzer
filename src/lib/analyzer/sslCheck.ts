import { SSLResult } from './types';
import tls from 'tls';

/**
 * Check SSL/TLS status with STRICT trust chain validation.
 * 
 * Key design decisions:
 * 1. HTTPS = enabled ONLY if we made a successful trusted request AND the final URL is https://
 * 2. Uses rejectUnauthorized: true for trust chain validation
 * 3. Falls back to untrusted connection to gather cert details for display
 * 4. Checks HTTP→HTTPS redirect behavior
 */
export async function checkSSL(url: string): Promise<SSLResult> {
  const defaultResult: SSLResult = {
    enabled: false,
    trusted: false,
    valid: false,
    protocol: null,
    issuer: null,
    expiryDate: null,
    daysUntilExpiry: null,
    certIssue: null,
    httpToHttpsRedirect: null,
    httpsVerified: false,
    finalUrl: null,
    error: null,
  };

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    return { ...defaultResult, error: 'Invalid URL' };
  }

  const hostname = parsedUrl.hostname;
  const port = parsedUrl.port ? parseInt(parsedUrl.port) : 443;

  // Step 1: Try to actually make a verified HTTPS request
  // This is the STRICT check — HTTPS is only "enabled" if we can verify it works
  const httpsVerification = await verifyHttpsWorks(url);

  // Step 2: Check TLS trust chain independently
  const trustedCheck = await checkTrustedConnection(hostname, port);

  // Step 3: If not trusted, try untrusted connection to get cert details
  let certDetails: {
    protocol: string | null;
    validFrom: Date | null;
    validTo: Date | null;
    issuer: string | null;
    certIssue: SSLResult['certIssue'];
  } | null = null;

  if (!trustedCheck.trusted) {
    certDetails = await checkUntrustedConnection(hostname, port);
  } else {
    certDetails = trustedCheck.certDetails;
  }

  // Step 4: Check HTTP→HTTPS redirect
  const httpToHttpsRedirect = await checkHttpRedirect(hostname);

  // Step 5: Build result
  const now = new Date();
  const validFrom = certDetails?.validFrom;
  const validTo = certDetails?.validTo;

  const isDateValid = validFrom && validTo
    ? (now >= validFrom && now <= validTo)
    : false;

  const daysUntilExpiry = validTo
    ? Math.ceil((validTo.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    : null;

  // Determine cert issue
  let certIssue: SSLResult['certIssue'] = null;
  if (!trustedCheck.trusted) {
    if (certDetails?.certIssue) {
      certIssue = certDetails.certIssue;
    } else if (!isDateValid && validTo && now > validTo) {
      certIssue = 'expired';
    } else {
      certIssue = 'untrusted-root';
    }
  }

  // HTTPS is "enabled" if we can make a verified HTTPS request to the site.
  // This is the STRICT interpretation: if browsers would show warnings, HTTPS is not "enabled".
  // Sites like neverssl.com may have port 443 open with TLS, but if the cert isn't trusted,
  // we don't consider HTTPS as truly "enabled" because browsers would block/warn.
  // 
  // However, we differentiate two cases:
  // 1. No TLS at all → enabled=false, httpsVerified=false (truly no HTTPS)
  // 2. TLS exists but untrusted → enabled=true, httpsVerified=false (HTTPS exists but broken)
  // We use httpsVerified as the definitive answer to "does HTTPS work properly?"
  const hasTlsConnection = trustedCheck.connected || certDetails !== null;
  const httpsEnabled = httpsVerification.success;  // STRICT: only true if full HTTPS request succeeds
  const httpsVerified = httpsVerification.success;

  // If we can't verify HTTPS but TLS connection exists, we note this
  const hasUntrustedTLS = !httpsVerification.success && hasTlsConnection;

  return {
    enabled: httpsEnabled,
    trusted: httpsEnabled && trustedCheck.trusted,
    valid: httpsEnabled && trustedCheck.trusted && isDateValid,
    protocol: certDetails?.protocol || trustedCheck.certDetails?.protocol || null,
    issuer: certDetails?.issuer || trustedCheck.certDetails?.issuer || null,
    expiryDate: validTo?.toISOString() || null,
    daysUntilExpiry,
    certIssue,
    httpToHttpsRedirect,
    httpsVerified: httpsVerified,
    finalUrl: httpsVerification.finalUrl,
    error: !hasTlsConnection
      ? 'Could not establish HTTPS connection'
      : hasUntrustedTLS
      ? `HTTPS server exists on port 443 but certificate is not trusted — browsers will show security warnings (${certIssue || 'untrusted certificate'})`
      : null,
  };
}

/**
 * STRICT HTTPS verification:
 * Actually try to make a successful HTTPS request.
 * HTTPS is only "enabled" if:
 * 1. The request succeeds (status 200-ish)
 * 2. The final URL after redirects is https://
 * 
 * This prevents sites like neverssl.com from being marked as "HTTPS enabled"
 * just because a TLS connection can be established to port 443.
 */
async function verifyHttpsWorks(url: string): Promise<{
  success: boolean;
  finalUrl: string | null;
  error?: string;
}> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);

    // Ensure we're checking HTTPS
    const httpsUrl = url.replace(/^http:\/\//, 'https://');

    const response = await fetch(httpsUrl, {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; SecurityAnalyzer/1.0)',
      },
    });

    clearTimeout(timeout);

    // Check if the final URL is https://
    const finalUrl = response.url || httpsUrl;
    const isHttpsFinal = finalUrl.startsWith('https://');

    // Check for successful response (2xx or 3xx that we followed)
    const isSuccess = response.ok || (response.status >= 200 && response.status < 400);

    return {
      success: isHttpsFinal && isSuccess,
      finalUrl: isHttpsFinal ? finalUrl : null,
      error: !isHttpsFinal
        ? 'Site does not serve HTTPS (final URL is HTTP)'
        : !isSuccess
        ? `HTTPS request returned status ${response.status}`
        : undefined,
    };
  } catch (error: any) {
    const errorMsg = error?.cause?.code || error?.code || error?.message || '';

    // Distinguish between "no HTTPS at all" vs "HTTPS exists but cert is bad"
    const isCertError = errorMsg.includes('CERT') ||
      errorMsg.includes('certificate') ||
      errorMsg.includes('SSL') ||
      errorMsg.includes('UNABLE_TO_VERIFY_LEAF_SIGNATURE') ||
      errorMsg.includes('SELF_SIGNED_CERT');

    if (isCertError) {
      // HTTPS server exists, but cert is untrusted
      // Don't mark as "enabled" since browsers would block this
      return {
        success: false,
        finalUrl: null,
        error: `HTTPS server exists but certificate is not trusted: ${errorMsg}`,
      };
    }

    // No HTTPS at all (connection refused, timeout, DNS failure)
    return {
      success: false,
      finalUrl: null,
      error: 'Could not establish HTTPS connection',
    };
  }
}

/**
 * Attempt a trusted TLS connection to verify the certificate chain.
 * Uses rejectUnauthorized: true so Node.js validates the full chain.
 */
function checkTrustedConnection(
  hostname: string,
  port: number
): Promise<{
  connected: boolean;
  trusted: boolean;
  certDetails: {
    protocol: string | null;
    validFrom: Date | null;
    validTo: Date | null;
    issuer: string | null;
  } | null;
  error?: string;
}> {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      resolve({
        connected: false,
        trusted: false,
        certDetails: null,
        error: 'SSL connection timed out',
      });
    }, 10000);

    try {
      const socket = tls.connect(
        {
          host: hostname,
          port,
          servername: hostname,
          rejectUnauthorized: true, // ACTUALLY validate the trust chain
        },
        () => {
          clearTimeout(timeout);
          const cert = socket.getPeerCertificate();
          const protocol = socket.getProtocol();
          const authorized = socket.authorized;

          const certDetails = cert && Object.keys(cert).length > 0
            ? {
                protocol,
                validFrom: cert.valid_from ? new Date(cert.valid_from) : null,
                validTo: cert.valid_to ? new Date(cert.valid_to) : null,
                issuer: cert.issuer?.O || cert.issuer?.CN || null,
              }
            : null;

          socket.destroy();
          resolve({
            connected: true,
            trusted: authorized,
            certDetails,
          });
        }
      );

      socket.on('error', (err: any) => {
        clearTimeout(timeout);

        let error = err.message;

        resolve({
          connected: true, // Connection succeeded, just not trusted
          trusted: false,
          certDetails: null,
          error,
        });
      });
    } catch (err: any) {
      clearTimeout(timeout);
      resolve({
        connected: false,
        trusted: false,
        certDetails: null,
        error: err.message,
      });
    }
  });
}

/**
 * Attempt an untrusted TLS connection to extract certificate details
 * even when the certificate is not trusted (self-signed, expired, etc.)
 */
function checkUntrustedConnection(
  hostname: string,
  port: number
): Promise<{
  protocol: string | null;
  validFrom: Date | null;
  validTo: Date | null;
  issuer: string | null;
  certIssue: SSLResult['certIssue'];
} | null> {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      resolve(null);
    }, 10000);

    try {
      const socket = tls.connect(
        {
          host: hostname,
          port,
          servername: hostname,
          rejectUnauthorized: false, // Allow untrusted certs to extract info
        },
        () => {
          clearTimeout(timeout);

          const cert = socket.getPeerCertificate();
          if (!cert || Object.keys(cert).length === 0) {
            socket.destroy();
            resolve(null);
            return;
          }

          const protocol = socket.getProtocol();
          const validFrom = cert.valid_from ? new Date(cert.valid_from) : null;
          const validTo = cert.valid_to ? new Date(cert.valid_to) : null;
          const issuer = cert.issuer?.O || cert.issuer?.CN || null;
          const now = new Date();

          // Determine the specific cert issue
          let certIssue: SSLResult['certIssue'] = 'untrusted-root';

          // Check if self-signed (issuer === subject)
          const subjectCN = cert.subject?.CN;
          const issuerCN = cert.issuer?.CN;
          if (subjectCN && issuerCN && subjectCN === issuerCN) {
            certIssue = 'self-signed';
          }

          // Check if expired
          if (validTo && now > validTo) {
            certIssue = 'expired';
          }

          // Check hostname mismatch
          if (cert.subjectaltname) {
            const sanNames = cert.subjectaltname
              .split(', ')
              .map((entry: string) => entry.replace(/^DNS:/, ''));
            const matchesHostname = sanNames.some(
              (name: string) => name === hostname || 
                (name.startsWith('*.') && hostname.endsWith(name.slice(1)))
            );
            if (!matchesHostname) {
              certIssue = 'hostname-mismatch';
            }
          }

          socket.destroy();
          resolve({
            protocol,
            validFrom,
            validTo,
            issuer,
            certIssue,
          });
        }
      );

      socket.on('error', () => {
        clearTimeout(timeout);
        resolve(null);
      });
    } catch {
      clearTimeout(timeout);
      resolve(null);
    }
  });
}

/**
 * Check if HTTP redirects to HTTPS.
 * Makes an HTTP request and checks if the response redirects to HTTPS.
 */
async function checkHttpRedirect(hostname: string): Promise<boolean | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const response = await fetch(`http://${hostname}/`, {
      method: 'GET',
      redirect: 'manual', // Don't follow redirects
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; SecurityAnalyzer/1.0)',
      },
    });

    clearTimeout(timeout);

    // Check if the response is a redirect to HTTPS
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get('location');
      if (location && location.startsWith('https://')) {
        return true;
      }
    }

    // If HTTP returns 200 OK without redirect, no HTTPS redirect
    return false;
  } catch {
    // If HTTP connection fails entirely, that's actually fine
    // (may mean only HTTPS is served, or HTTP is blocked)
    return null;
  }
}
