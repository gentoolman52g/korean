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

type DocType = 'law' | 'policy' | 'company' | 'other';

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [apiKey, setApiKey] = useState('');
  const [isCallingMiso, setIsCallingMiso] = useState(false);

  const [inputText, setInputText] = useState('');
  const [processedText, setProcessedText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<{
    originalLength: number;
    processedLength: number;
    chunkCount: number;
  } | null>(null);
  const [spellcheckInfo, setSpellcheckInfo] = useState<{
    segmentCount: number;
    segments: string[];
  } | null>(null);
  const [docType, setDocType] = useState<DocType>('law');

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

      // 3단계: 맞춤법 검사용 세그먼트 분할 및 API 호출 (파이프라인 테스트용)
      try {
        const spellResponse = await fetch('/api/spellcheck', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            text: rawText,
            maxLength: 500,
          }),
        });

        const spellResult = await spellResponse.json();

        if (spellResponse.ok && spellResult?.data?.correctedText) {
          setInputText(spellResult.data.correctedText);
          if (
            typeof spellResult.data.segmentCount === 'number' &&
            Array.isArray(spellResult.data.segments)
          ) {
            setSpellcheckInfo({
              segmentCount: spellResult.data.segmentCount,
              segments: spellResult.data.segments as string[],
            });
          }
        } else {
          // 맞춤법 API 호출 실패 시 원문 사용
          setInputText(rawText);
        }
      } catch (spellError) {
        console.error('[v0] Spellcheck error:', spellError);
        // 맞춤법 단계 에러는 치명적이지 않으므로 원문 사용
        setInputText(rawText);
      }
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
      setStats(result.data.stats);
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
    link.download = `preprocessed_data_${new Date().getTime()}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleReset = () => {
    setFile(null);
    setInputText('');
    setProcessedText('');
    setStats(null);
    setSpellcheckInfo(null);
    setError(null);
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-background to-muted/20 py-8 px-4">
      <div className="container max-w-7xl mx-auto">
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-bold mb-2 text-balance">RAG 텍스트 전처리 시스템</h1>
          <p className="text-muted-foreground text-lg text-balance">
            미소 API를 통해 파일을 처리하고 RAG 시스템에 최적화된 형태로 전처리합니다
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
              미소 API 파일 업로드
            </CardTitle>
            <CardDescription>
              문서 또는 이미지 파일을 업로드하면 미소 API가 처리하여 텍스트로 변환합니다
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="file">파일 선택</Label>
              <Input
                id="file"
                type="file"
                accept=".txt,.md,.pdf,.html,.xlsx,.xls,.docx,.csv,.pptx,.ppt,.jpg,.jpeg,.png,.gif,.webp,.svg"
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
                  미소 API 처리 중...
                </>
              ) : (
                <>
                  <Zap className="mr-2 h-4 w-4" />
                  미소로 파일 처리하기
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {spellcheckInfo && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5" />
                맞춤법 세그먼트 테스트 대시보드
              </CardTitle>
              <CardDescription>
                현재 텍스트가 500자 이내 세그먼트로 어떻게 분할되었는지 확인합니다
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="text-sm text-muted-foreground">
                세그먼트 개수: {spellcheckInfo.segmentCount.toLocaleString()}개
              </div>
              <div className="max-h-64 overflow-auto border rounded-md p-3 bg-muted/40">
                {spellcheckInfo.segments.map((segment, index) => (
                  <div key={index} className="mb-3 last:mb-0">
                    <div className="text-xs text-muted-foreground font-mono mb-1">
                      [세그먼트 {index + 1}] ({segment.length}자)
                    </div>
                    <pre className="whitespace-pre-wrap break-words text-xs font-mono">
                      {segment}
                    </pre>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid lg:grid-cols-2 gap-6">
          {/* 입력 영역 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                전처리 전 텍스트
              </CardTitle>
              <CardDescription>
                미소 API 결과가 여기에 표시됩니다. 수정 후 전처리를 시작하세요
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                placeholder="미소 API로 처리된 텍스트가 여기에 표시됩니다..."
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
                        법령
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem
                        id="doc-policy"
                        value="policy"
                      />
                      <Label htmlFor="doc-policy">
                        사규/내부 규정
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem
                        id="doc-company"
                        value="company"
                      />
                      <Label htmlFor="doc-company">
                        일반 회사 자료
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
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                전처리 후 텍스트
              </CardTitle>
              <CardDescription>
                결과를 검토하고 필요시 수정한 후 다운로드하세요
              </CardDescription>
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

        <Card className="mt-6">
          <CardHeader>
            <CardTitle>지원 파일 형식</CardTitle>
            <CardDescription>
              미소 API가 처리할 수 있는 파일 형식
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-4 text-sm">
              <div>
                <h4 className="font-semibold mb-2">문서 (Document)</h4>
                <p className="text-muted-foreground">
                  TXT, MD, PDF, HTML, XLSX, XLS, DOCX, CSV, PPTX, PPT, XML, EPUB
                </p>
              </div>
              <div>
                <h4 className="font-semibold mb-2">이미지 (Image)</h4>
                <p className="text-muted-foreground">
                  JPG, JPEG, PNG, GIF, WEBP, SVG
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
