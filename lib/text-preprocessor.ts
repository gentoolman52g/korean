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
export type DocType = 'law' | 'excel' | 'research_paper' | 'other';

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
  text = text.replace(/\(\s+/g, '(').replace(/\s+\)/g, ')');
  // 쉼표, 마침표 앞 공백 제거
  text = text.replace(/\s+([,.])/g, '$1');
  
  return text;
}

/**
 * 개선된 재귀적 청킹 (Recursive Character Text Splitter)
 * - 구분자 우선순위: \n\n -> \n -> . -> 공백 -> 글자
 * - 청크 간 오버랩(Overlap) 지원으로 문맥 끊김 방지
 */
function chunkTextOptimized(
  text: string,
  maxChunkSize: number = 4000,
  overlapSize: number = 200 // 약 5% 오버랩
): string[] {
  const separators = ['\n\n', '\n', '.', ' ', ''];
  
  function splitRecursive(text: string, separatorIdx: number): string[] {
    const finalChunks: string[] = [];
    const separator = separators[separatorIdx];
    
    // 더 이상 나눌 구분자가 없거나, 텍스트가 이미 충분히 작으면 반환
    if (text.length <= maxChunkSize || separatorIdx >= separators.length) {
      return [text];
    }

    // 현재 구분자로 분할
    let parts: string[];
    if (separator === '') {
      parts = text.split('');
    } else if (separator === '.') {
      // 문침표는 뒤에 공백이 오는 경우를 주로 타겟팅 (단순화)
      parts = text.split('. ').map((p, i, arr) => i < arr.length - 1 ? p + '. ' : p);
    } else {
      parts = text.split(separator);
    }
    
    let currentDoc = '';
    
    for (let i = 0; i < parts.length; i++) {
      let part = parts[i];
      // 구분자 복원 (split으로 사라진 경우)
      if (separator === '\n\n' || separator === '\n') {
        // 줄바꿈은 뒤에 붙여주는 것이 자연스러움 (단, 마지막 조각 제외)
        if (i < parts.length - 1) part += separator;
      }
      
      // 현재 조각 하나가 이미 maxChunkSize보다 크면 -> 다음 단계 구분자로 더 깊게 들어감
      if (part.length > maxChunkSize) {
        // 지금까지 모은건 저장
        if (currentDoc) {
          finalChunks.push(currentDoc);
          currentDoc = '';
        }
        // 큰 조각은 재귀적으로 분할하여 추가
        finalChunks.push(...splitRecursive(part, separatorIdx + 1));
        continue;
      }

      // 병합 시도
      if (currentDoc.length + part.length > maxChunkSize) {
        if (currentDoc) {
           finalChunks.push(currentDoc);
           
           // Overlap 로직: 이전 청크의 끝부분을 가져와서 새 청크의 시작으로 삼음
           if (overlapSize > 0 && currentDoc.length > overlapSize) {
             // 단순히 뒤에서 자르면 단어가 잘릴 수 있으므로, 공백 기준으로 찾는게 좋지만
             // 여기선 단순화하여 길이로 처리하되, 앞부분 공백 제거
             currentDoc = currentDoc.slice(-overlapSize).trimStart(); 
           } else {
             currentDoc = '';
           }
        }
        currentDoc += part;
      } else {
        currentDoc += part;
      }
    }
    
    if (currentDoc) {
      finalChunks.push(currentDoc);
    }
    
    return finalChunks;
  }

  return splitRecursive(text, 0);
}

/**
 * 기존 단순 청킹 (하위 호환성 유지 또는 Fallback용)
 */
function chunkText(text: string, maxChunkSize: number = 4000): string[] {
  return chunkTextOptimized(text, maxChunkSize, 0); // 오버랩 없이 호출
}

/**
 * 논문/보고서의 반복되는 페이지 헤더/푸터 제거
 * - 전체 라인 중 일정 횟수 이상 반복되고, 문장 형태가 아닌 짧은 텍스트를 헤더로 간주
 */
function removePageHeaders(text: string): string {
  const lines = text.split('\n');
  const lineCounts = new Map<string, number>();
  
  // 빈도 분석
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    // 너무 긴 문장은 본문일 확률이 높음 (50자 이하만 체크)
    if (trimmed.length > 50) continue; 
    
    lineCounts.set(trimmed, (lineCounts.get(trimmed) || 0) + 1);
  }
  
  // 전체 라인 수 대비 1% 이상 등장하거나 3회 이상 등장하는 짧은 라인은 제거 후보
  // (논문 저자명, 저널명 등이 보통 페이지마다 나옴)
  const headerCandidates = new Set<string>();
  const threshold = Math.max(3, lines.length * 0.01); 
  
  for (const [line, count] of lineCounts.entries()) {
    if (count >= threshold) {
      headerCandidates.add(line);
    }
  }
  
  // 필터링
  return lines.filter(line => !headerCandidates.has(line.trim())).join('\n');
}

/**
 * 학술 논문 구조 기반 청킹
 * - "1. 서론", "2.1 연구방법" 등 계층적 번호 구조 인식
 */
function chunkResearchPaper(text: string, maxChunkSize: number = 4000): string[] {
  // 1. 페이지 헤더/푸터 노이즈 제거
  const cleanText = removePageHeaders(text);
  
  // 2. 섹션 헤더 패턴 (예: "1. 서론", "2.1. 실험 결과", "IV. 결론")
  // 숫자+점 조합 또는 로마자 숫자 등을 매칭
  const sectionPattern = /^(?:제\s*)?[\dIVX]+(?:\.[\d]+)*\.?\s+[^\n]+$/gm;
  
  if (!sectionPattern.test(cleanText)) {
    // 섹션 구조가 명확하지 않으면 개선된 일반 청킹 사용
    return chunkTextOptimized(cleanText, maxChunkSize);
  }

  const chunks: string[] = [];
  const lines = cleanText.split('\n');
  let currentBuffer = '';
  
  // 섹션 시작 라인인지 판별하는 함수
  const isSectionStart = (line: string) => /^(?:제\s*)?[\dIVX]+(?:\.[\d]+)*\.?\s+[^\n]+$/.test(line.trim());

  for (const line of lines) {
    if (isSectionStart(line)) {
      // 새로운 섹션 시작
      if (currentBuffer.trim()) {
        // 이전 버퍼가 maxChunkSize보다 크면 재귀적 분할 적용
        if (currentBuffer.length > maxChunkSize) {
          chunks.push(...chunkTextOptimized(currentBuffer, maxChunkSize));
        } else {
          chunks.push(currentBuffer.trim());
        }
      }
      currentBuffer = line;
    } else {
      currentBuffer = currentBuffer ? `${currentBuffer}\n${line}` : line;
    }
  }

  // 마지막 버퍼 처리
  if (currentBuffer.trim()) {
    if (currentBuffer.length > maxChunkSize) {
      chunks.push(...chunkTextOptimized(currentBuffer, maxChunkSize));
    } else {
      chunks.push(currentBuffer.trim());
    }
  }

  // 병합 로직 (너무 작은 섹션들은 합치기)
  const mergedChunks: string[] = [];
  let mergeBuffer = '';
  
  for (const chunk of chunks) {
    if ((mergeBuffer + '\n\n' + chunk).length <= maxChunkSize) {
      mergeBuffer = mergeBuffer ? `${mergeBuffer}\n\n${chunk}` : chunk;
    } else {
      if (mergeBuffer) mergedChunks.push(mergeBuffer);
      mergeBuffer = chunk;
    }
  }
  if (mergeBuffer) mergedChunks.push(mergeBuffer);

  return mergedChunks;
}

/**
 * 법령 및 규정 구조 기반 청킹
 * - "제N장", "제N조" 등의 구조를 파악하여 의미 단위 보존
 * - 구조가 없으면 일반 청킹으로 fallback
 */
function chunkLawStructure(text: string, maxChunkSize: number = 4000): string[] {
  // 1. 법령 구조(장/조)가 있는지 확인하는 정규식
  const lawPattern = /^제\s*\d+\s*[조장]/gm;
  
  if (!lawPattern.test(text)) {
    // 법령 구조가 아니면 일반 청킹 사용
    return chunkText(text, maxChunkSize);
  }

  // 2. 전체 텍스트를 "제N조" 패턴으로 split하되, 구분자(제N조...)도 포함하도록 처리
  // split with capture group을 사용하면 구분자도 배열에 포함됨
  // 예: "제1조... 제2조..." -> split(/(제\s*\d+\s*조[^]*?)(?=제\s*\d+\s*조)/) 방식은 복잡
  // 대신 정규식으로 매칭되는 지점들을 찾아서 substring으로 자르는 방식이 안전

  const chunks: string[] = [];
  const lines = text.split('\n');
  let currentBuffer = '';

  const isStructureStart = (line: string) => /^\s*제\s*\d+\s*[조장]/.test(line);

  for (const line of lines) {
    // 새로운 조/장이 시작되는 라인인지 확인
    if (isStructureStart(line)) {
      // 새로운 조가 시작되면 이전까지의 버퍼를 청크로 저장
      if (currentBuffer.trim()) {
         chunks.push(currentBuffer.trim());
      }
      // 새 조의 시작으로 버퍼 초기화
      currentBuffer = line;
    } else {
      // 조의 내용이면 버퍼에 추가
      currentBuffer = currentBuffer ? `${currentBuffer}\n${line}` : line;
    }
  }

  // 마지막 버퍼 처리
  if (currentBuffer.trim()) {
    chunks.push(currentBuffer.trim());
  }

  // 3. 만들어진 청크들을 maxChunkSize에 맞춰서 다시 병합하거나 분할
  const finalChunks: string[] = [];
  let mergeBuffer = '';

  for (const chunk of chunks) {
    // 단일 조항이 너무 큰 경우 분할
    if (chunk.length > maxChunkSize) {
      // 먼저 병합 버퍼가 있으면 털어냄
      if (mergeBuffer) {
        finalChunks.push(mergeBuffer);
        mergeBuffer = '';
      }
      // 큰 조항은 일반 청킹 로직으로 분할
      finalChunks.push(...chunkText(chunk, maxChunkSize));
    } else {
      // 병합 가능한지 확인
      if ((mergeBuffer + '\n\n' + chunk).length <= maxChunkSize) {
        mergeBuffer = mergeBuffer ? `${mergeBuffer}\n\n${chunk}` : chunk;
      } else {
        // 병합 불가하면 기존 버퍼 저장하고 새로 시작
        if (mergeBuffer) finalChunks.push(mergeBuffer);
        mergeBuffer = chunk;
      }
    }
  }

  // 남은 버퍼 처리
  if (mergeBuffer) {
    finalChunks.push(mergeBuffer);
  }

  return finalChunks;
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
 * CSV 파서 (따옴표 처리 포함)
 */
function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (inQuotes) {
      if (char === '"') {
        if (nextChar === '"') {
          currentField += '"';
          i++; // 따옴표 이스케이프 스킵
        } else {
          inQuotes = false;
        }
      } else {
        currentField += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        currentRow.push(currentField);
        currentField = '';
      } else if (char === '\n' || (char === '\r' && nextChar === '\n')) {
        currentRow.push(currentField);
        rows.push(currentRow);
        currentRow = [];
        currentField = '';
        if (char === '\r') i++; // \n 스킵
      } else if (char === '\r') {
         // \n 없는 \r 처리
         currentRow.push(currentField);
         rows.push(currentRow);
         currentRow = [];
         currentField = '';
      } else {
        currentField += char;
      }
    }
  }
  // 마지막 필드/행 처리
  if (currentField || currentRow.length > 0) {
    currentRow.push(currentField);
    rows.push(currentRow);
  }
  return rows;
}

/**
 * 엑셀 파일 전용 전처리 (스마트 헤더 유지 & 행 단위 보존)
 * - CSV 파싱 후 마크다운 표로 변환
 * - 청크 분할 시 헤더를 자동으로 포함하여 문맥 유지
 */
function preprocessExcel(text: string): PreprocessResult {
  // 1. 시트 분리
  const sheetRegex = /\[Sheet: (.*?)\]/g;
  const parts = text.split(sheetRegex);
  
  const chunks: string[] = [];
  const maxChunkSize = 4000;
  
  // 처리할 섹션 식별
  let sections: {name: string, content: string}[] = [];
  if (parts.length > 1) {
    for (let i = 1; i < parts.length; i += 2) {
      const sheetName = parts[i];
      const content = parts[i + 1];
      if (content && content.trim()) {
        sections.push({ name: sheetName, content });
      }
    }
  } else {
    sections.push({ name: 'Sheet1', content: text });
  }

  let currentChunk = '';

  for (const section of sections) {
    // CSV 파싱
    const rows = parseCSV(section.content.trim());
    if (rows.length === 0) continue;

    // 헤더 추출 (첫 번째 유효한 행)
    const headerRow = rows[0];
    const dataRows = rows.slice(1);
    
    // 마크다운 헤더 생성
    const mdHeader = 
      `| ${headerRow.map(c => c.trim().replace(/[\r\n]+/g, ' ')).join(' | ')} |\n` +
      `| ${headerRow.map(() => '---').join(' | ')} |`;
    
    // 시트 제목 추가
    const sheetTitle = `### Sheet: ${section.name}\n\n`;
    
    // 우선 현재 청크에 시트 제목을 넣을 수 있는지 확인
    if ((currentChunk + '\n\n' + sheetTitle).length > maxChunkSize) {
      chunks.push(currentChunk);
      currentChunk = '';
    }
    
    // 시트 제목 추가
    if (currentChunk === '') {
      currentChunk = sheetTitle + mdHeader;
    } else {
      currentChunk += '\n\n' + sheetTitle + mdHeader;
    }
    
    // 데이터 행 처리
    for (const row of dataRows) {
      // 빈 행 건너뛰기
      if (row.every(c => !c.trim())) continue;
      
      const mdRow = `| ${row.map(c => c.trim().replace(/[\r\n]+/g, ' ')).join(' | ')} |`;
      
      // 추가 시 크기 초과 확인
      if ((currentChunk + '\n' + mdRow).length > maxChunkSize) {
        // 현재 청크 저장
        chunks.push(currentChunk);
        
        // 새 청크 시작: 문맥 유지를 위해 시트 제목과 헤더를 다시 넣어줌
        currentChunk = `${sheetTitle.trim()} (continued)\n\n${mdHeader}\n${mdRow}`;
      } else {
        currentChunk += '\n' + mdRow;
      }
    }
  }

  if (currentChunk) {
    chunks.push(currentChunk);
  }
  
  const processedText = chunks.join('\n\n@@@\n\n');

  return {
    processedText,
    chunks,
    stats: {
      originalLength: text.length,
      processedLength: processedText.length,
      chunkCount: chunks.length,
    },
  };
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
 */
export function preprocessByDocType(
  text: string,
  docType: DocType,
): PreprocessResult {
  switch (docType) {
    case 'law': {
      const { originalLength, processed } = basePreprocess(text);
      const chunks = chunkLawStructure(processed);
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
    case 'research_paper': {
      // 논문: 페이지 헤더 제거 및 섹션 단위 청킹 + Recursive Fallback
      const { originalLength, processed } = basePreprocess(text);
      // chunkResearchPaper 내부에서 removePageHeaders 호출함
      const chunks = chunkResearchPaper(processed); 
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
    case 'excel': {
      // 엑셀 파일: 헤더 보존 및 행 단위 청킹
      return preprocessExcel(text);
    }
    case 'other':
    default: {
      const { originalLength, processed } = basePreprocess(text);
      // 개선된 재귀적 청킹 + 오버랩 사용
      const chunks = chunkTextOptimized(processed);
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
  }
}

