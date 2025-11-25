'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Download,
  FileText,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Upload,
  Zap,
} from 'lucide-react';
import {
  RadioGroup,
  RadioGroupItem,
} from '@/components/ui/radio-group';
import * as XLSX from 'xlsx';

  type DocType = 'law' | 'excel' | 'research_paper' | 'other';

import { ChunkViewerModal } from '@/components/chunk-viewer-modal';

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [apiKey, setApiKey] = useState('');
  const [isCallingMiso, setIsCallingMiso] = useState(false);

  const [rawMisoText, setRawMisoText] = useState('');
  const [inputText, setInputText] = useState('');
  const [processedText, setProcessedText] = useState('');
  const [processedChunks, setProcessedChunks] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isChunkModalOpen, setIsChunkModalOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<{
    originalLength: number;
    processedLength: number;
    chunkCount: number;
  } | null>(null);
  const [docType, setDocType] = useState<DocType>('law');
  // 파일 입력 컴포넌트 강제 초기화를 위한 키
  const [inputKey, setInputKey] = useState(Date.now());

  // 미소 스펙 및 Node.js 런타임 업로드 한도에 맞춘 최대 업로드 크기 (50MB)
  const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024; // 50MB

  const handleMisoProcess = async () => {
    if (!file) {
      setError('파일을 선택해주세요.');
      return;
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      setError('파일 용량이 50MB를 초과했습니다. 50MB 이하 파일만 업로드할 수 있습니다.');
      return;
    }

    // 1. 텍스트 파일은 로컬에서 바로 읽기 (Miso API 호출 안함)
    const textExtensions = ['txt', 'md', 'markdown', 'json', 'csv', 'log', 'xml', 'yml', 'yaml'];
    const excelExtensions = ['xlsx', 'xls', 'ods'];
    const fileExtension = file.name.split('.').pop()?.toLowerCase();

    // 1-1. 텍스트 파일 처리
    if (fileExtension && textExtensions.includes(fileExtension)) {
      console.log('[Local] Reading text file directly:', file.name);
      
      // 로딩 상태 잠깐 표시 (UX)
      setIsCallingMiso(true);
      setError(null);

      try {
        // Blob.text() 메서드로 텍스트 추출
        const text = await file.text();
        
        setRawMisoText(text);
        setInputText(text);
        // 확장자가 csv나 json이면 'excel'이나 'other'로 자동 설정할 수도 있음
        if (fileExtension === 'csv') setDocType('excel');
        else if (fileExtension === 'json') setDocType('other');
        
        console.log('[Local] File read complete. Length:', text.length);
      } catch (err) {
        console.error('[Local] File read error:', err);
        setError('로컬 파일 읽기 중 오류가 발생했습니다.');
      } finally {
        setIsCallingMiso(false);
      }
      return; // Miso API 호출 건너뜀
    }

    // 1-2. 엑셀 파일 처리
    if (fileExtension && excelExtensions.includes(fileExtension)) {
      console.log('[Local] Parsing Excel file locally:', file.name);
      setIsCallingMiso(true);
      setError(null);

      try {
        const arrayBuffer = await file.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer);
        
        let fullText = '';
        
        // 모든 시트 순회
        workbook.SheetNames.forEach((sheetName) => {
          const sheet = workbook.Sheets[sheetName];
          // CSV 형태로 변환 (가독성 좋음)
          const csvText = XLSX.utils.sheet_to_csv(sheet);
          
          if (csvText.trim()) {
            fullText += `[Sheet: ${sheetName}]\n${csvText}\n\n`;
          }
        });

        if (!fullText.trim()) {
          throw new Error('엑셀 파일에서 텍스트를 추출할 수 없습니다 (빈 파일일 수 있음).');
        }

        setRawMisoText(fullText);
        setInputText(fullText);
        setDocType('excel'); // 문서 종류를 엑셀로 자동 설정

        console.log('[Local] Excel parse complete. Length:', fullText.length);
      } catch (err) {
        console.error('[Local] Excel parse error:', err);
        setError('엑셀 파일 파싱 중 오류가 발생했습니다: ' + (err instanceof Error ? err.message : String(err)));
      } finally {
        setIsCallingMiso(false);
      }
      return; // Miso API 호출 건너뜀
    }

    // 2. 그 외(PDF, 이미지 등)는 Miso API로 처리
    setIsCallingMiso(true);
    setError(null);

    try {
      // 1단계: 파일 업로드
      console.log('[v0] Step 1: Uploading file to MISO');
      const uploadFormData = new FormData();
      uploadFormData.append('file', file);

      const uploadResponse = await fetch('/api/miso/upload', {
        method: 'POST',
        body: uploadFormData,
      });

      const uploadResult = await uploadResponse.json();

      if (!uploadResponse.ok) {
        throw new Error(uploadResult.error || '파일 업로드 중 오류가 발생했습니다.');
      }

      console.log('[v0] Step 1 complete: File uploaded with ID', uploadResult.fileId);

      // 2단계: 워크플로우 실행
      console.log('[v0] Step 2: Running MISO workflow');
      const workflowResponse = await fetch('/api/miso', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          fileId: uploadResult.fileId,
          fileName: uploadResult.fileName 
        }),
      });

      const workflowResult = await workflowResponse.json();

      if (!workflowResponse.ok) {
        throw new Error(workflowResult.error || '미소 API 호출 중 오류가 발생했습니다.');
      }

      console.log('[v0] Step 2 complete: Workflow executed successfully');

      const rawText: string = workflowResult.data.result;
      setRawMisoText(rawText);
      setInputText(rawText);

      setError(null);
    } catch (err) {
      console.error('[v0] MISO process error:', err);
      setError(err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.');
    } finally {
      setIsCallingMiso(false);
    }
  };

  const handleProcess = async () => {
    if (!inputText.trim()) {
      setError('처리할 텍스트를 입력해주세요.');
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      const response = await fetch('/api/preprocess', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: inputText,
          docType,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || '전처리 중 오류가 발생했습니다.');
      }

      setProcessedText(result.data.processedText);
      setProcessedChunks(result.data.chunks || []);
      setStats(result.data.stats);
      
      console.log('[Page] Preprocessing complete:');
      console.log('  - Chunks received:', result.data.chunks?.length || 0);
      console.log('  - Stats:', result.data.stats);
    } catch (err) {
      setError(err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.');
      console.error('[v0] Processing error:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownload = () => {
    if (!processedText) return;

    const blob = new Blob([processedText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    
    // 파일명 결정 로직
    let fileName = `preprocessed_data_${new Date().getTime()}.txt`;
    if (file) {
      // 확장자 제거 후 [전처리] 접두사 추가
      const originalName = file.name.replace(/\.[^/.]+$/, "");
      fileName = `[전처리] ${originalName}.txt`;
    }

    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleReset = () => {
    setFile(null);
    setRawMisoText('');
    setInputText('');
    setProcessedText('');
    setStats(null);
    setError(null);
    setProcessedChunks([]);
    // 파일 입력 필드 초기화를 위해 키 변경
    setInputKey(Date.now());
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-background to-muted/20 py-8 px-4">
      <div className="container max-w-7xl mx-auto">
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-bold mb-2 text-balance">RAG 텍스트 전처리 시스템</h1>
          <p className="text-muted-foreground text-lg text-balance">
            파일을 처리하고 RAG 시스템에 최적화된 형태로 전처리합니다
          </p>
        </div>

        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="whitespace-pre-wrap">{error}</AlertDescription>
          </Alert>
        )}

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              파일 업로드
            </CardTitle>
            <CardDescription>
              문서 또는 이미지 파일을 업로드하면 텍스트로 변환합니다
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="file">파일 선택</Label>
              <Input
                key={inputKey}
                id="file"
                type="file"
                accept=".txt,.md,.markdown,.json,.csv,.log,.xml,.yml,.yaml,.pdf,.html,.xlsx,.xls,.docx,.pptx,.ppt,.jpg,.jpeg,.png,.gif,.webp,.svg"
                onChange={(e) => {
                  const selectedFile = e.target.files?.[0];
                  if (selectedFile) {
                    setFile(selectedFile);
                  }
                }}
              />
              {file && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <FileText className="h-4 w-4" />
                  <span>{file.name} ({(file.size / 1024).toFixed(2)} KB)</span>
                </div>
              )}
            </div>

            <Button 
              onClick={handleMisoProcess} 
              disabled={isCallingMiso || !file}
              className="w-full"
            >
              {isCallingMiso ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  파일 처리 중...
                </>
              ) : (
                <>
                  <Zap className="mr-2 h-4 w-4" />
                  파일 처리하기
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* 입력 영역 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                전처리 전 텍스트
              </CardTitle>
              <CardDescription>
                추출된 텍스트가 여기에 표시됩니다. 수정 후 전처리를 시작하세요
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                placeholder="추출된 텍스트가 여기에 표시됩니다..."
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                className="min-h-[400px] font-mono text-sm"
              />
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label>문서 종류</Label>
                  <RadioGroup
                    value={docType}
                    onValueChange={(value) =>
                      setDocType(value as DocType)
                    }
                    className="flex flex-wrap gap-4"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem
                        id="doc-law"
                        value="law"
                      />
                      <Label htmlFor="doc-law">
                        법령 및 사규
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem
                        id="doc-excel"
                        value="excel"
                      />
                      <Label htmlFor="doc-excel">
                        엑셀 파일
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem
                        id="doc-research-paper"
                        value="research_paper"
                      />
                      <Label htmlFor="doc-research-paper">
                        논문/보고서
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem
                        id="doc-other"
                        value="other"
                      />
                      <Label htmlFor="doc-other">
                        기타
                      </Label>
                    </div>
                  </RadioGroup>
                </div>
                <div className="flex gap-2">
                <Button 
                  onClick={handleProcess} 
                  disabled={isProcessing || !inputText.trim()}
                  className="flex-1"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      처리 중...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                      전처리 시작
                    </>
                  )}
                </Button>
                <Button onClick={handleReset} variant="outline">
                  초기화
                </Button>
              </div>
              </div>
              {inputText && (
                <div className="text-sm text-muted-foreground">
                  입력 길이: {inputText.length.toLocaleString()}자
                </div>
              )}
            </CardContent>
          </Card>

          {/* 결과 영역 */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    전처리 후 텍스트
                  </CardTitle>
                  <CardDescription className="mt-1.5">
                    결과를 검토하고 필요시 수정한 후 다운로드하세요
                  </CardDescription>
                </div>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setIsChunkModalOpen(true)}
                  disabled={!processedChunks.length}
                >
                  <FileText className="mr-2 h-4 w-4" />
                  청크별 보기
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                placeholder="전처리된 결과가 여기에 표시됩니다..."
                value={processedText}
                onChange={(e) => setProcessedText(e.target.value)}
                className="min-h-[400px] font-mono text-sm"
                disabled={!processedText}
              />
              <Button 
                onClick={handleDownload} 
                disabled={!processedText}
                className="w-full"
              >
                <Download className="mr-2 h-4 w-4" />
                TXT 파일 다운로드
              </Button>
              {stats && (
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary">
                    원본: {stats.originalLength.toLocaleString()}자
                  </Badge>
                  <Badge variant="secondary">
                    처리 후: {stats.processedLength.toLocaleString()}자
                  </Badge>
                  <Badge variant="secondary">
                    청크: {stats.chunkCount}개
                  </Badge>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <ChunkViewerModal 
          isOpen={isChunkModalOpen}
          onClose={() => setIsChunkModalOpen(false)}
          chunks={processedChunks}
        />
      </div>
    </main>
  );
}
