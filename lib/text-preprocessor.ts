/**
 * RAG 시스템을 위한 텍스트 전처리 유틸리티
 * 중복 제거, 공백 정규화, 특수 문자 제거, 청킹 기능 제공
 */

export interface PreprocessResult {
  processedText: string;
  chunks: string[];
  stats: {
    originalLength: number;
    processedLength: number;
    chunkCount: number;
  };
}

// 문서 유형
export type DocType = 'law' | 'policy' | 'company' | 'other';

/**
 * 중복 문단 제거
 */
function removeDuplicateParagraphs(text: string): string {
  const paragraphs = text.split(/\n\n+/);
  const seen = new Set<string>();
  const uniqueParagraphs: string[] = [];

  for (const paragraph of paragraphs) {
    const trimmed = paragraph.trim();
    if (trimmed && !seen.has(trimmed)) {
      seen.add(trimmed);
      uniqueParagraphs.push(trimmed);
    }
  }

  return uniqueParagraphs.join('\n\n');
}

/**
 * 공백 정규화 - 여러 줄바꿈과 연속 공백 정리
 */
function normalizeWhitespace(text: string): string {
  // 연속된 공백을 하나로
  text = text.replace(/ +/g, ' ');
  // 탭을 공백으로
  text = text.replace(/\t+/g, ' ');
  // 3개 이상의 연속 줄바꿈을 2개로 (문단 구분)
  text = text.replace(/\n{3,}/g, '\n\n');
  // 줄 시작/끝 공백 제거
  text = text.split('\n').map(line => line.trim()).join('\n');
  // 앞뒤 공백 제거
  return text.trim();
}

/**
 * 특수 문자 및 불필요한 정보 제거
 */
function removeSpecialCharacters(text: string): string {
  // 제어 문자 제거 (탭, 줄바꿈 제외)
  text = text.replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '');
  // 깨진 유니코드 문자 제거
  text = text.replace(/[\uFFFD]/g, '');
  // 특수 공백 문자를 일반 공백으로
  text = text.replace(/[\u00A0\u2000-\u200B\u202F\u205F\u3000]/g, ' ');
  // 불필요한 특수 기호 제거 (단, 문장 부호는 유지)
  text = text.replace(/[​‌‍]/g, ''); // Zero-width characters
  
  return text;
}

/**
 * 텍스트 정제 - AI가 이해하기 쉽도록 단순화
 */
function cleanText(text: string): string {
  // 연속된 구두점 정리
  text = text.replace(/([.!?])\1+/g, '$1');
  // 괄호 안 공백 제거
  text = text.replace(/$$\s+/g, '(').replace(/\s+$$/g, ')');
  // 쉼표, 마침표 앞 공백 제거
  text = text.replace(/\s+([,.])/g, '$1');
  
  return text;
}

/**
 * 텍스트를 의미 단위로 청킹 (최대 4000자)
 */
function chunkText(text: string, maxChunkSize: number = 4000): string[] {
  const chunks: string[] = [];
  const paragraphs = text.split(/\n\n+/);
  
  let currentChunk = '';
  
  for (const paragraph of paragraphs) {
    const trimmedParagraph = paragraph.trim();
    if (!trimmedParagraph) continue;
    
    // 현재 청크에 문단을 추가했을 때 크기 확인
    const potentialChunk = currentChunk 
      ? `${currentChunk}\n\n${trimmedParagraph}`
      : trimmedParagraph;
    
    if (potentialChunk.length <= maxChunkSize) {
      // 추가 가능
      currentChunk = potentialChunk;
    } else {
      // 현재 청크가 있으면 저장
      if (currentChunk) {
        chunks.push(currentChunk);
      }
      
      // 문단 자체가 maxChunkSize보다 큰 경우 문장 단위로 분할
      if (trimmedParagraph.length > maxChunkSize) {
        const sentences = trimmedParagraph.split(/([.!?]\s+)/);
        let sentenceChunk = '';
        
        for (let i = 0; i < sentences.length; i++) {
          const sentence = sentences[i];
          if (!sentence.trim()) continue;
          
          if ((sentenceChunk + sentence).length <= maxChunkSize) {
            sentenceChunk += sentence;
          } else {
            if (sentenceChunk) {
              chunks.push(sentenceChunk.trim());
            }
            sentenceChunk = sentence;
          }
        }
        
        if (sentenceChunk.trim()) {
          currentChunk = sentenceChunk.trim();
        } else {
          currentChunk = '';
        }
      } else {
        // 새 청크 시작
        currentChunk = trimmedParagraph;
      }
    }
  }
  
  // 마지막 청크 추가
  if (currentChunk) {
    chunks.push(currentChunk);
  }
  
  return chunks;
}

/**
 * 맞춤법 검사용: 텍스트를 최대 maxLength 글자 이내 세그먼트로 분할
 * - 줄바꿈 단위를 최대한 유지하면서 500자 이하 블록으로 쌓음
 * - 한 줄이 너무 길면 maxLength 기준으로 잘라서 추가
 */
export function splitTextIntoSegments(
  text: string,
  maxLength: number = 500,
): string[] {
  const segments: string[] = [];
  let current = '';

  const pushCurrent = () => {
    if (current.trim().length > 0) {
      segments.push(current);
    }
    current = '';
  };

  const lines = text.split('\n');

  for (const line of lines) {
    // 현재 세그먼트에 이 줄을 그대로 넣었을 때 길이 계산
    const lineToAdd = current ? `\n${line}` : line;

    // 한 줄 자체가 너무 긴 경우: 줄 내부에서 잘라서 세그먼트 생성
    if (lineToAdd.length > maxLength) {
      // 먼저 현재 세그먼트가 비어있지 않으면 밀어넣기
      if (current) {
        pushCurrent();
      }

      let start = 0;
      const trimmedLine = line;
      while (start < trimmedLine.length) {
        const chunk = trimmedLine.slice(start, start + maxLength);
        segments.push(chunk);
        start += maxLength;
      }
      current = '';
      continue;
    }

    // 현재 세그먼트에 이 줄까지 넣으면 maxLength를 넘는 경우
    if ((current + lineToAdd).length > maxLength) {
      // 지금까지 쌓인 세그먼트를 확정하고 새 세그먼트 시작
      pushCurrent();
      current = line;
    } else {
      // 그대로 현재 세그먼트에 추가
      current = current ? `${current}\n${line}` : line;
    }
  }

  // 마지막 세그먼트 추가
  if (current.trim().length > 0) {
    segments.push(current);
  }

  return segments;
}

/**
 * 공통 전처리 파이프라인 (청킹 전 단계까지)
 */
function basePreprocess(text: string): { originalLength: number; processed: string } {
  const originalLength = text.length;

  // 1. 중복 문단 제거
  let processed = removeDuplicateParagraphs(text);

  // 2. 특수 문자 제거
  processed = removeSpecialCharacters(processed);

  // 3. 공백 정규화
  processed = normalizeWhitespace(processed);

  // 4. 텍스트 정제
  processed = cleanText(processed);

  return { originalLength, processed };
}

/**
 * 법령(법률) 전용: 조(條) 단위 청킹
 * - 부칙 내 조문도 동일 규칙으로 처리
 * - 조가 너무 길면 공통 청킹 로직으로 한 번 더 분할
 */
function chunkLawByArticle(text: string, maxChunkSize: number = 4000): string[] {
  // 제1조, 1조, 제1조의2 등 대응
  const rawChunks = text
    .split(/(?=제?\d+조(?:의?\d*)?)/g)
    .map(chunk => chunk.trim())
    .filter(chunk => chunk.length > 0);

  const finalChunks: string[] = [];

  for (const chunk of rawChunks) {
    if (chunk.length <= maxChunkSize) {
      finalChunks.push(chunk);
    } else {
      // 조 하나가 너무 긴 경우: 기존 일반 청킹 로직 재사용
      const subChunks = chunkText(chunk, maxChunkSize);
      finalChunks.push(...subChunks);
    }
  }

  return finalChunks;
}

/**
 * 전체 전처리 파이프라인 실행 (일반 문서용)
 */
export function preprocessText(text: string): PreprocessResult {
  const { originalLength, processed } = basePreprocess(text);

  // 5. 청킹 (일반 문서: 문단/문장 기반)
  const chunks = chunkText(processed);

  // 청크를 '@@@' 구분자로 연결
  const processedText = chunks.join('\n\n@@@\n\n');

  return {
    processedText,
    chunks,
    stats: {
      originalLength,
      processedLength: processed.length,
      chunkCount: chunks.length,
    },
  };
}

/**
 * 문서 유형별 전처리 파이프라인
 * - 현재는 공통 파이프라인을 재사용하지만,
 *   향후 법령/사규/일반 회사 자료별로 세부 규칙을 확장할 수 있도록 분리
 */
export function preprocessByDocType(
  text: string,
  docType: DocType,
): PreprocessResult {
  switch (docType) {
    case 'law': {
      // 법령 전용 전처리: 공통 정제 후 조(條) 단위 청킹
      const { originalLength, processed } = basePreprocess(text);
      const chunks = chunkLawByArticle(processed);
      const processedText = chunks.join('\n\n@@@\n\n');

      return {
        processedText,
        chunks,
        stats: {
          originalLength,
          processedLength: processed.length,
          chunkCount: chunks.length,
        },
      };
    }
    case 'policy': {
      // TODO: 사규/규정집 전용 규칙 추가
      return preprocessText(text);
    }
    case 'company': {
      // TODO: 일반 회사 자료 전용 규칙 추가
      return preprocessText(text);
    }
    case 'other':
    default: {
      return preprocessText(text);
    }
  }
}
