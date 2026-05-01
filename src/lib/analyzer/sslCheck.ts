import { SSLResult } from './types';
import tls from 'tls';

export async function checkSSL(url: string): Promise<SSLResult> {
  const defaultResult: SSLResult = {
    enabled: false,
    protocol: null,
    valid: false,
    issuer: null,
    expiryDate: null,
    daysUntilExpiry: null,
    error: null,
  };

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    return { ...defaultResult, error: 'Invalid URL' };
  }

  // Check if URL uses HTTPS
  if (parsedUrl.protocol !== 'https:') {
    return { ...defaultResult, error: 'Site does not use HTTPS' };
  }

  const hostname = parsedUrl.hostname;
  const port = parsedUrl.port ? parseInt(parsedUrl.port) : 443;

  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      resolve({ ...defaultResult, error: 'SSL connection timed out' });
    }, 10000);

    try {
      const socket = tls.connect(
        {
          host: hostname,
          port: port,
          servername: hostname,
          rejectUnauthorized: false, // We want to check even invalid certs
        },
        () => {
          clearTimeout(timeout);

          const cert = socket.getPeerCertificate();

          if (!cert || Object.keys(cert).length === 0) {
            socket.destroy();
            resolve({ ...defaultResult, error: 'No certificate found' });
            return;
          }

          const validFrom = cert.valid_from ? new Date(cert.valid_from) : null;
          const validTo = cert.valid_to ? new Date(cert.valid_to) : null;
          const now = new Date();

          const isValid = socket.authorized || 
            (validFrom && validTo && now >= validFrom && now <= validTo);

          const daysUntilExpiry = validTo
            ? Math.ceil((validTo.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
            : null;

          const issuer = cert.issuer?.O || cert.issuer?.CN || null;

          const protocol = socket.getProtocol();

          socket.destroy();

          resolve({
            enabled: true,
            protocol: protocol,
            valid: isValid,
            issuer: issuer,
            expiryDate: validTo?.toISOString() || null,
            daysUntilExpiry: daysUntilExpiry,
            error: null,
          });
        }
      );

      socket.on('error', (err) => {
        clearTimeout(timeout);
        resolve({ ...defaultResult, error: `SSL check failed: ${err.message}` });
      });
    } catch (err: any) {
      clearTimeout(timeout);
      resolve({ ...defaultResult, error: `SSL check failed: ${err.message}` });
    }
  });
}
