// Web Worker for processing files (Excel, etc.) without blocking the main thread
import * as XLSX from 'xlsx';

self.onmessage = async (e: MessageEvent) => {
  const { file, type } = e.data;

  try {
    if (type === 'excel') {
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer);
      let fullText = '';

      workbook.SheetNames.forEach((sheetName) => {
        const sheet = workbook.Sheets[sheetName];
        const csvText = XLSX.utils.sheet_to_csv(sheet);
        if (csvText.trim()) {
          fullText += `[Sheet: ${sheetName}]\n${csvText}\n\n`;
        }
      });

      if (!fullText.trim()) {
        throw new Error('엑셀 파일에서 텍스트를 추출할 수 없습니다.');
      }

      self.postMessage({ status: 'success', text: fullText });
    } else {
      throw new Error(`Unsupported file type: ${type}`);
    }
  } catch (err) {
    self.postMessage({ 
      status: 'error', 
      error: err instanceof Error ? err.message : 'Unknown worker error' 
    });
  }
};

