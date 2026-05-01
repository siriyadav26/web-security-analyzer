import { NextRequest, NextResponse } from 'next/server';
import { analyzeUrl, validateUrl } from '@/lib/analyzer';
import { db } from '@/lib/db';

export const runtime = 'nodejs';
export const maxDuration = 30;

export async function POST(request: NextRequest) {
  try {
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
    try {
      await db.scan.create({
        data: {
          url: result.url,
          score: result.score,
          riskLevel: result.riskLevel,
          headers: JSON.stringify(result.headers),
          ssl: JSON.stringify(result.ssl),
          ports: JSON.stringify(result.ports),
          vulnerabilities: JSON.stringify(result.vulnerabilities),
          suggestions: JSON.stringify(result.suggestions),
          context: JSON.stringify(result.context),
        },
      });
    } catch (dbError) {
      console.error('Failed to save scan to database:', dbError);
    }

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Analysis error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to analyze the website' },
      { status: 500 }
    );
  }
}
