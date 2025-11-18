import { NextRequest, NextResponse } from 'next/server';
import { splitTextIntoSegments } from '@/lib/text-preprocessor';
import { spellcheckSegments } from '@/lib/spellcheck-client';

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

    // 1) 500자 이하 세그먼트로 분할
    const segments = splitTextIntoSegments(text, safeMaxLength);

    // 2) 외부 맞춤법 검사기 API를 통해 세그먼트별 교정
    const correctedSegments = await spellcheckSegments(segments);
    const correctedText = correctedSegments.join('\n');

    return NextResponse.json({
      success: true,
      data: {
        correctedText,
        segments: correctedSegments,
        segmentCount: correctedSegments.length,
        maxLength: safeMaxLength,
      },
    });
  } catch (error) {
    console.error('[spellcheck] API error:', error);
    return NextResponse.json(
      {
        error: '맞춤법 검사 API 처리 중 오류가 발생했습니다.',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}

