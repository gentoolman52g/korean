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

  type DocType = 'law' | 'excel' | 'research_paper' | 'other';

import { ChunkViewerModal } from '@/components/chunk-viewer-modal';
import { ChunkFlowViewer } from '@/components/chunk-flow-viewer';
import { Switch } from '@/components/ui/switch';

import { useFileProcessor } from '@/hooks/useFileProcessor';

export default function Home() {
  const {
    file,
    inputText,
    processedText,
    processedChunks,
    docType,
    stats,
    error,
    status,
    // Actions
    setFile,
    setInputText,
    setDocType,
    setProcessedText,
    reset,
    handleFileRead,
    processText,
  } = useFileProcessor();

  const [inputKey, setInputKey] = useState(Date.now());
  const [isChunkModalOpen, setIsChunkModalOpen] = useState(false);
  const [showChunkFlow, setShowChunkFlow] = useState(false);

  const handleReset = () => {
    reset();
    setInputKey(Date.now());
  };

  const handleDownload = () => {
    if (!processedText) return;

    const blob = new Blob([processedText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    
    let fileName = `preprocessed_data_${new Date().getTime()}.txt`;
    if (file) {
      const originalName = file.name.replace(/\.[^/.]+$/, "");
      fileName = `[전처리] ${originalName}.txt`;
    }

    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
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
              onClick={() => file && handleFileRead(file)} 
              disabled={status === 'reading' || status === 'uploading' || !file}
              className="w-full"
            >
              {status === 'reading' || status === 'uploading' ? (
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

        <div className="grid lg:grid-cols-2 gap-6 items-stretch">
          {/* 입력 영역 */}
          <Card className="flex flex-col h-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                전처리 전 텍스트
              </CardTitle>
              <CardDescription>
                추출된 텍스트가 여기에 표시됩니다. 수정 후 전처리를 시작하세요
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col space-y-4">
              <Textarea
                placeholder="추출된 텍스트가 여기에 표시됩니다..."
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                className="flex-1 min-h-[400px] font-mono text-sm resize-none"
              />
              <div className="mt-auto space-y-3">
                <div className="min-h-[60px] flex flex-col justify-end space-y-2">
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
                  onClick={processText} 
                  disabled={status === 'processing' || !inputText.trim()}
                  className="flex-1"
                >
                  {status === 'processing' ? (
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
              <div className="h-5 text-sm text-muted-foreground flex items-center">
                {inputText && (
                  <>입력 길이: {inputText.length.toLocaleString()}자</>
                )}
              </div>
            </CardContent>
          </Card>

          {/* 결과 영역 */}
          <Card className="flex flex-col h-full">
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
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Switch 
                      id="chunk-flow-mode"
                      checked={showChunkFlow}
                      onCheckedChange={setShowChunkFlow}
                      disabled={!processedChunks.length}
                    />
                    <Label htmlFor="chunk-flow-mode" className="text-sm cursor-pointer whitespace-nowrap">
                      시각화
                    </Label>
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
              </div>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col space-y-4 min-h-0 overflow-hidden">
              {showChunkFlow ? (
                <div className="flex-1 min-h-[400px] overflow-hidden">
                  <ChunkFlowViewer chunks={processedChunks} />
                </div>
              ) : (
                <Textarea
                  placeholder="전처리된 결과가 여기에 표시됩니다..."
                  value={processedText}
                  onChange={(e) => setProcessedText(e.target.value)}
                  className="flex-1 min-h-[400px] font-mono text-sm resize-none"
                  disabled={!processedText}
                />
              )}
              <div className="mt-auto space-y-3 shrink-0">
                <div className="min-h-[60px] flex items-end pb-1">
                {stats ? (
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
                ) : (
                  <div aria-hidden="true" />
                )}
                </div>
                <Button 
                  onClick={handleDownload} 
                  disabled={!processedText}
                  className="w-full"
                >
                  <Download className="mr-2 h-4 w-4" />
                  TXT 파일 다운로드
                </Button>
              </div>
              <div className="h-1" aria-hidden="true" />
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
