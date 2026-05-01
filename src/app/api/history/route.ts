import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const runtime = 'nodejs';

function parseScan(scan: any) {
  return {
    ...scan,
    headers: JSON.parse(scan.headers),
    ssl: JSON.parse(scan.ssl),
    ports: JSON.parse(scan.ports),
    vulnerabilities: JSON.parse(scan.vulnerabilities),
    suggestions: JSON.parse(scan.suggestions),
    context: scan.context ? JSON.parse(scan.context) : {
      hasForms: false,
      hasLogin: false,
      isStaticSite: false,
      detectionNotes: 'Context data not available for this scan.',
    },
  };
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');

    if (id) {
      // Get a specific scan
      const scan = await db.scan.findUnique({
        where: { id },
      });

      if (!scan) {
        return NextResponse.json(
          { error: 'Scan not found' },
          { status: 404 }
        );
      }

      return NextResponse.json(parseScan(scan));
    }

    // Get all scans, most recent first
    const scans = await db.scan.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    const parsedScans = scans.map(scan => parseScan(scan));

    return NextResponse.json(parsedScans);
  } catch (error: any) {
    console.error('History fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch scan history' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'Scan ID is required' },
        { status: 400 }
      );
    }

    await db.scan.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Delete error:', error);
    return NextResponse.json(
      { error: 'Failed to delete scan' },
      { status: 500 }
    );
  }
}
