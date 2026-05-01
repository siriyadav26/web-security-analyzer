import { PortResult } from './types';
import net from 'net';

const PORTS_TO_CHECK = [
  { port: 80, service: 'HTTP' },
  { port: 443, service: 'HTTPS' },
  { port: 21, service: 'FTP' },
  { port: 22, service: 'SSH' },
];

function checkPort(hostname: string, port: number, timeout = 3000): Promise<PortResult> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    const result: PortResult = {
      port,
      service: PORTS_TO_CHECK.find(p => p.port === port)?.service || 'Unknown',
      open: false,
      status: 'filtered',
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
    }));
  }

  const hostname = parsedUrl.hostname;

  const results = await Promise.all(
    PORTS_TO_CHECK.map(p => checkPort(hostname, p.port))
  );

  return results;
}
