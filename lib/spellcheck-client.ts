const DEFAULT_TIMEOUT_MS = 8000;

async function callExternalSpellcheck(
  text: string,
  controller: AbortController,
): Promise<string> {
  const endpoint = process.env.SPELLCHECK_API_URL;

  if (!endpoint) {
    // 외부 서버가 설정되지 않은 경우, 원문을 그대로 반환
    return text;
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8',
    },
    body: new URLSearchParams({ text }).toString(),
    signal: controller.signal,
  });

  if (!response.ok) {
    // 외부 서버 오류 시에도 원문 유지
    return text;
  }

  const data = (await response.json()) as {
    resultText?: string;
    corrected?: string;
    [key: string]: unknown;
  };

  // 외부 API 응답 포맷에 따라 필드 이름을 조정할 수 있도록 유연하게 처리
  return (
    (typeof data.corrected === 'string' && data.corrected) ||
    (typeof data.resultText === 'string' && data.resultText) ||
    text
  );
}

export async function spellcheckSegments(
  segments: string[],
): Promise<string[]> {
  if (segments.length === 0) return [];

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  try {
    const corrected = await Promise.all(
      segments.map((segment) => callExternalSpellcheck(segment, controller)),
    );

    return corrected;
  } finally {
    clearTimeout(timeout);
  }
}


