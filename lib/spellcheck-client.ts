const PER_REQUEST_TIMEOUT_MS = 45000; // 개별 요청 타임아웃 45초
const CONCURRENCY_LIMIT = 2; // 동시 요청 수 2개
const MAX_RETRIES = 3; // 최대 재시도 횟수
const RETRY_DELAY_MS = 2000; // 재시도 대기 시간

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 맞춤법 검사기 API가 싫어할 만한 특수문자 제거
 */
function cleanTextForSpellcheck(text: string): string {
  return text
    // 제어 문자 제거 (줄바꿈/탭 제외)
    .replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '')
    .trim();
}

async function callExternalSpellcheck(
  text: string,
  retryCount = 0
): Promise<string> {
  const endpoint = process.env.SPELLCHECK_API_URL;

  if (!endpoint) {
    console.warn('[Spellcheck] SPELLCHECK_API_URL is not set');
    return text;
  }

  const cleanedText = cleanTextForSpellcheck(text);
  if (!cleanedText || cleanedText.length < 2) return text;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PER_REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8',
      },
      body: new URLSearchParams({ text: cleanedText }).toString(),
      signal: controller.signal,
    });

    // 응답 파싱 시도
    let data;
    try {
      data = await response.json();
    } catch (e) {
      // JSON이 아니면 텍스트로 에러 확인
      const textBody = await response.text().catch(() => '');
      if (!response.ok) {
         throw new Error(`Server error ${response.status}: ${textBody.slice(0, 100)}`);
      }
      // 200 OK인데 JSON이 아니면 원문 반환 (매우 드문 케이스)
      return text;
    }

    // 결과 추출 (성공이든 500이든 data가 있으면 확인)
    const corrected = 
      (typeof data?.corrected === 'string' && data.corrected) ||
      (typeof data?.resultText === 'string' && data.resultText);

    if (corrected) {
      // 변경 사항 로깅
      if (corrected !== cleanedText) {
        console.log(`[Spellcheck] Fixed: "${cleanedText.slice(0, 20)}..." -> "${corrected.slice(0, 20)}..."`);
      } else {
        console.log(`[Spellcheck] No changes for: "${cleanedText.slice(0, 20)}..."`);
      }
      
      // 500 에러여도 교정된 텍스트가 있으면 성공으로 간주하고 반환!
      return corrected;
    }

    // 결과도 없고 status도 에러면 진짜 에러
    if (!response.ok) {
       throw new Error(`Server error ${response.status}: ${JSON.stringify(data).slice(0, 100)}`);
    }

    // 200 OK인데 결과 필드가 비어있으면 원문 반환
    return text;

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const isTimeout = error instanceof Error && error.name === 'AbortError';

    console.warn(`[Spellcheck] Attempt ${retryCount + 1}/${MAX_RETRIES + 1} failed: ${errorMessage}`);

    if (retryCount < MAX_RETRIES) {
      clearTimeout(timeout);
      await sleep(RETRY_DELAY_MS * (retryCount + 1));
      return callExternalSpellcheck(text, retryCount + 1);
    }
    
    console.error(`[Spellcheck] Final failure for segment "${text.slice(0, 20)}...":`, errorMessage);
    return text;
  } finally {
    clearTimeout(timeout);
  }
}

export async function spellcheckSegments(
  segments: string[],
): Promise<string[]> {
  if (segments.length === 0) return [];

  const results: string[] = new Array(segments.length).fill('');
  
  for (let i = 0; i < segments.length; i += CONCURRENCY_LIMIT) {
    const chunk = segments.slice(i, i + CONCURRENCY_LIMIT);
    const chunkIndices = chunk.map((_, idx) => i + idx);
    
    console.log(`[Spellcheck] Processing batch ${Math.floor(i / CONCURRENCY_LIMIT) + 1}/${Math.ceil(segments.length / CONCURRENCY_LIMIT)} (${chunk.length} items)`);

    const chunkResults = await Promise.all(
      chunk.map(segment => callExternalSpellcheck(segment))
    );

    chunkResults.forEach((result, idx) => {
      results[chunkIndices[idx]] = result;
    });
    
    if (i + CONCURRENCY_LIMIT < segments.length) {
      await sleep(1000);
    }
  }

  return results;
}
