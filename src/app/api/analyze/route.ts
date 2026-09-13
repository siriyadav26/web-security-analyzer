import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/authOptions';
import { analyzeUrl, validateUrl } from '@/lib/analyzer';
import { db } from '@/lib/db';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as any)?.id || null;

    const body = await request.json();
    const { url } = body;

    if (!url || typeof url !== 'string') {
      return NextResponse.json(
        { error: 'URL is required' },
        { status: 400 }
      );
    }

    // Validate URL
    const validation = validateUrl(url.trim());
    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      );
    }

    // Perform security analysis
    const result = await analyzeUrl(url.trim());

    // Save to database
    let savedId: string | null = null;
    try {
      const created = await db.scan.create({
        data: {
          userId,
          url: result.url,
          score: result.score,
          riskLevel: result.riskLevel,
          headers: JSON.stringify(result.headers),
          ssl: JSON.stringify(result.ssl),
          ports: JSON.stringify(result.ports),
          vulnerabilities: JSON.stringify(result.vulnerabilities),
          suggestions: JSON.stringify(result.suggestions),
          context: JSON.stringify(result.context),
          analysisMode: result.analysisMode,
          limitations: JSON.stringify(result.limitations),
          scoreBreakdown: JSON.stringify(result.scoreBreakdown),
          primaryRisk: result.primaryRisk,
        },
      });
      savedId = created.id;
    } catch (dbError) {
      console.error('Failed to save scan to database:', dbError);
    }

    return NextResponse.json({ ...result, id: savedId ?? undefined });
  } catch (error: any) {
    console.error('Analysis error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to analyze the website' },
      { status: 500 }
    );
  }
}
