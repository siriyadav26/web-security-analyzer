import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const runtime = 'nodejs';

function parseScan(scan: any) {
  const context = scan.context ? JSON.parse(scan.context) : {
    siteType: 'unknown',
    hasForms: false,
    hasLogin: false,
    isStaticSite: false,
    isApi: false,
    detectionNotes: 'Context data not available for this scan.',
  };

  // Ensure context has new fields (backwards compatibility with old scans)
  if (!context.siteType) {
    context.siteType = context.isStaticSite ? 'static' : 'interactive';
  }
  if (context.isApi === undefined) {
    context.isApi = false;
  }

  return {
    ...scan,
    headers: JSON.parse(scan.headers),
    ssl: {
      ...JSON.parse(scan.ssl),
      httpsVerified: JSON.parse(scan.ssl).httpsVerified ?? JSON.parse(scan.ssl).enabled,
      finalUrl: JSON.parse(scan.ssl).finalUrl ?? null,
    },
    ports: JSON.parse(scan.ports),
    vulnerabilities: JSON.parse(scan.vulnerabilities),
    suggestions: JSON.parse(scan.suggestions),
    context,
    analysisMode: scan.analysisMode || 'secure',
    limitations: scan.limitations ? JSON.parse(scan.limitations) : [
      'This scan was performed before the limitations feature was added.',
      'Results may differ from current analysis.',
    ],
    scoreBreakdown: scan.scoreBreakdown ? JSON.parse(scan.scoreBreakdown) : [],
    primaryRisk: scan.primaryRisk || null,
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
