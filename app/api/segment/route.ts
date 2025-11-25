import { NextRequest, NextResponse } from 'next/server';
import { splitTextIntoSegments } from '@/lib/text-preprocessor';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const { text, maxLength } = body as {
      text?: string;
      maxLength?: number;
    };

    if (!text || typeof text !== 'string') {
      return NextResponse.json(
        { error: '유효한 텍스트(text)가 필요합니다.' },
        { status: 400 },
      );
    }

    const safeMaxLength =
      typeof maxLength === 'number' && Number.isFinite(maxLength)
        ? Math.max(1, Math.min(maxLength, 500))
        : 500;

    const segments = splitTextIntoSegments(text, safeMaxLength);

    return NextResponse.json({
      success: true,
      data: {
        segments,
        segmentCount: segments.length,
        maxLength: safeMaxLength,
      },
    });
  } catch (error) {
    console.error('[segment] API error:', error);
    return NextResponse.json(
      {
        error: '세그먼트 분할 중 오류가 발생했습니다.',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}

