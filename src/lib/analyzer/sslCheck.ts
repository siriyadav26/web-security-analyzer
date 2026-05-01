import { SSLResult } from './types';
import tls from 'tls';

/**
 * Check SSL/TLS status with proper trust chain validation.
 * 
 * Key improvements:
 * 1. First attempts a trusted connection (rejectUnauthorized: true)
 *    to verify the certificate is actually trusted by the system CA store.
 * 2. Falls back to untrusted connection to gather certificate details
 *    even when the cert is invalid/self-signed.
 * 3. Checks HTTP→HTTPS redirect behavior.
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

  // Step 1: Check if HTTPS is available and certificate is trusted
  const trustedCheck = await checkTrustedConnection(hostname, port);

  // Step 2: If not trusted, try untrusted connection to get cert details
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

  // Step 3: Check HTTP→HTTPS redirect
  const httpToHttpsRedirect = await checkHttpRedirect(hostname);

  // Step 4: Build result
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

  return {
    enabled: trustedCheck.connected || certDetails !== null,
    trusted: trustedCheck.trusted,
    valid: trustedCheck.trusted && isDateValid,
    protocol: certDetails?.protocol || trustedCheck.certDetails?.protocol || null,
    issuer: certDetails?.issuer || trustedCheck.certDetails?.issuer || null,
    expiryDate: validTo?.toISOString() || null,
    daysUntilExpiry,
    certIssue,
    httpToHttpsRedirect,
    error: !trustedCheck.connected && certDetails === null
      ? trustedCheck.error || 'Could not establish HTTPS connection'
      : null,
  };
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

        // Parse the specific TLS error to understand WHY it failed
        let error = err.message;

        // If the connection was made but cert validation failed,
        // we can still extract some info. The error code tells us the issue.
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
