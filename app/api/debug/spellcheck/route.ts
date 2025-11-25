import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { text, endpoint } = await request.json();
    
    console.log('[DEBUG] Testing spellcheck endpoint:', endpoint);
    console.log('[DEBUG] Input text:', text);

    if (!endpoint) {
        return NextResponse.json({ error: 'Endpoint is required' }, { status: 400 });
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8',
      },
      body: new URLSearchParams({ text }).toString(),
    });

    const responseText = await response.text();
    console.log('[DEBUG] Response status:', response.status);
    console.log('[DEBUG] Response body:', responseText);

    return NextResponse.json({
      status: response.status,
      body: responseText,
    });

  } catch (error) {
    console.error('[DEBUG] Test failed:', error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : String(error) 
    }, { status: 500 });
  }
}

