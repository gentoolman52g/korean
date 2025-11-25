import { NextRequest, NextResponse } from 'next/server';
import { spellcheckSegments } from '@/lib/spellcheck-client';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { text } = body;

    if (!text) {
      return NextResponse.json({ error: 'Text is required' }, { status: 400 });
    }

    console.log('[DEBUG] Manual verification input:', text);
    
    const segments = [text];
    const correctedSegments = await spellcheckSegments(segments);
    const corrected = correctedSegments[0];

    const hasChanges = text !== corrected;

    console.log('[DEBUG] Has changes:', hasChanges);
    console.log('[DEBUG] Original:', text);
    console.log('[DEBUG] Corrected:', corrected);

    return NextResponse.json({
      original: text,
      corrected: corrected,
      hasChanges: hasChanges,
      diff: hasChanges ? {
        from: text,
        to: corrected
      } : null
    });

  } catch (error) {
    console.error('[DEBUG] Verification failed:', error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : String(error) 
    }, { status: 500 });
  }
}

