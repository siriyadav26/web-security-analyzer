import { PortResult } from './types';
import net from 'net';

const PORTS_TO_CHECK = [
  { port: 80, service: 'HTTP', risk: 'none' as const, note: 'Standard HTTP port — expected for web servers' },
  { port: 443, service: 'HTTPS', risk: 'none' as const, note: 'Standard HTTPS port — expected for secure web servers' },
  { port: 21, service: 'FTP', risk: 'medium' as const, note: 'FTP transmits data in plaintext — consider SFTP/FTPS instead' },
  { port: 22, service: 'SSH', risk: 'low' as const, note: 'SSH is encrypted but can be targeted for brute-force attacks' },
];

function checkPort(hostname: string, port: number, timeout = 3000): Promise<PortResult> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    const portInfo = PORTS_TO_CHECK.find(p => p.port === port);
    const result: PortResult = {
      port,
      service: portInfo?.service || 'Unknown',
      open: false,
      status: 'filtered',
      risk: portInfo?.risk || 'none',
      note: portInfo?.note,
    };

    socket.setTimeout(timeout);

    socket.on('connect', () => {
      result.open = true;
      result.status = 'open';
      socket.destroy();
      resolve(result);
    });

    socket.on('timeout', () => {
      result.status = 'filtered';
      socket.destroy();
      resolve(result);
    });

    socket.on('error', (err: any) => {
      if (err.code === 'ECONNREFUSED') {
        result.status = 'closed';
      } else {
        result.status = 'filtered';
      }
      socket.destroy();
      resolve(result);
    });

    socket.connect(port, hostname);
  });
}

export async function checkPorts(url: string): Promise<PortResult[]> {
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    return PORTS_TO_CHECK.map(p => ({
      port: p.port,
      service: p.service,
      open: false,
      status: 'filtered' as const,
      risk: p.risk,
      note: p.note,
    }));
  }

  const hostname = parsedUrl.hostname;

  const results = await Promise.all(
    PORTS_TO_CHECK.map(p => checkPort(hostname, p.port))
  );

  return results;
}
