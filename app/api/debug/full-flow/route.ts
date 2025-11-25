import { spellcheckSegments } from '@/lib/spellcheck-client';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { text } = body;

    if (!text) {
      return NextResponse.json({ error: 'Text is required' }, { status: 400 });
    }

    console.log('[DEBUG] Full flow test input:', text);
    
    const segments = [text];
    const result = await spellcheckSegments(segments);

    console.log('[DEBUG] Full flow test result:', result);

    return NextResponse.json({
      original: text,
      corrected: result[0],
    });

  } catch (error) {
    console.error('[DEBUG] Full flow test failed:', error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : String(error) 
    }, { status: 500 });
  }
}

