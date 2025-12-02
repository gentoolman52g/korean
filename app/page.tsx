'use client';

import { useState, useEffect, useRef } from 'react';
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
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

  type DocType = 'law' | 'excel' | 'research_paper' | 'other';

import { ChunkViewerModal } from '@/components/chunk-viewer-modal';
import { ChunkFlowViewer } from '@/components/chunk-flow-viewer';
import { Switch } from '@/components/ui/switch';

import { useFileProcessor } from '@/hooks/useFileProcessor';

// ReactMarkdown 플러그인: 모든 요소에 data-source-pos 속성을 주입하여 원본 위치 추적
const addSourcePosPlugin = () => {
  return (tree: any) => {
    const visit = (node: any) => {
      if (node.position && node.position.start && node.type !== 'root') {
        if (!node.data) node.data = {};
        if (!node.data.hProperties) node.data.hProperties = {};
        node.data.hProperties['data-source-pos'] = node.position.start.offset;
      }
      if (node.children) {
        node.children.forEach(visit);
      }
    };
    visit(tree);
  };
};

// Textarea 미러링을 위한 스타일 속성 목록
const MIRROR_STYLES = [
  'borderBottomWidth',
  'borderLeftWidth',
  'borderRightWidth',
  'borderTopWidth',
  'boxSizing',
  'fontFamily',
  'fontSize',
  'fontStyle',
  'fontWeight',
  'letterSpacing',
  'lineHeight',
  'paddingBottom',
  'paddingLeft',
  'paddingRight',
  'paddingTop',
  'tabSize',
  'textIndent',
  'textTransform',
  'width',
  'wordBreak',
  'wordSpacing',
  'wordWrap',
];

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
  const [showPreview, setShowPreview] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const scrollPosRef = useRef<number>(0); // 비율 대신 절대 위치 저장 시도 (또는 비율 유지하되 로직 강화)
  
  // 상태 변경 감지를 위한 ref
  const prevStatusRef = useRef(status);

  // Preview 모드로 전환될 때 스크롤 위치 복원
  useEffect(() => {
    if (showPreview && previewRef.current && scrollPosRef.current >= 0) {
      // 렌더링 직후에는 높이 계산이 정확하지 않을 수 있어 약간의 지연 후 실행
      requestAnimationFrame(() => {
        if (previewRef.current) {
          const { scrollHeight, clientHeight } = previewRef.current;
          const targetScrollTop = scrollPosRef.current * (scrollHeight - clientHeight);
          previewRef.current.scrollTop = targetScrollTop;
        }
      });
    }
  }, [showPreview]);

  // 편집 완료 핸들러
  const handleEditComplete = () => {
    if (textareaRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = textareaRef.current;
      // 현재 스크롤 비율 계산 (0 ~ 1)
      const maxScroll = scrollHeight - clientHeight;
      if (maxScroll > 0) {
        scrollPosRef.current = scrollTop / maxScroll;
      } else {
        scrollPosRef.current = 0;
      }
    }
    setShowPreview(true);
  };

  // 파일 로드나 텍스트 추출이 완료되면 자동으로 미리보기 모드 활성화
  useEffect(() => {
    const prevStatus = prevStatusRef.current;
    prevStatusRef.current = status;

    // 'reading' 또는 'uploading' -> 'idle' 상태로 변경될 때만 미리보기 활성화
    if ((prevStatus === 'reading' || prevStatus === 'uploading') && status === 'idle' && inputText) {
      setShowPreview(true);
    }
  }, [status, inputText]);

  // 편집 모드로 전환될 때 텍스트 위치 찾아가기
  const jumpToTextPosition = (targetText: string, offset?: number) => {
    if (!textareaRef.current || !inputText) return;
    
    let index = -1;

    if (typeof offset === 'number' && offset >= 0) {
      index = offset;
    } else {
      // 1. 클릭한 텍스트(일부)를 원본에서 검색
      // 너무 긴 텍스트는 앞부분 20자 정도만 사용하여 검색 정확도 높임
      const searchKeyword = targetText.slice(0, 30).trim(); 
      if (!searchKeyword) return;

      index = inputText.indexOf(searchKeyword);
    }
    
    if (index !== -1) {
      const textarea = textareaRef.current;
      
      // 2. 해당 위치로 커서 이동
      textarea.focus();
      textarea.setSelectionRange(index, index);

      // 3. 커서 위치의 정확한 Y좌표 계산 (Mirror Div 방식)
      // Textarea는 줄바꿈(wrapping)이 발생하므로 단순 줄 수 계산으로는 정확한 스크롤 위치를 알 수 없음
      // 따라서 숨겨진 div를 만들어 textarea와 동일한 스타일을 적용하고, 커서 위치까지의 높이를 직접 측정함
      const div = document.createElement('div');
      const styles = window.getComputedStyle(textarea);
      
      // 스타일 복사
      MIRROR_STYLES.forEach((key) => {
        // @ts-ignore
        div.style[key] = styles[key];
      });

      // 측정용 필수 스타일 오버라이드
      div.style.height = 'auto';
      div.style.minHeight = '0';
      div.style.maxHeight = 'none';
      div.style.overflow = 'hidden';
      div.style.position = 'absolute';
      div.style.top = '-9999px';
      div.style.left = '-9999px';
      div.style.visibility = 'hidden';
      div.style.whiteSpace = 'pre-wrap'; // textarea 기본값

      // 커서 위치까지의 텍스트 설정
      const textContent = inputText.substring(0, index);
      div.textContent = textContent;
      
      // 커서 위치를 나타내는 마커 추가
      const span = document.createElement('span');
      span.textContent = '|';
      div.appendChild(span);

      document.body.appendChild(div);
      
      // 높이 측정
      const targetTop = span.offsetTop;
      const computedLineHeight = parseInt(styles.lineHeight);
      const lineHeight = isNaN(computedLineHeight) ? 20 : computedLineHeight; // fallback 20px
      
      document.body.removeChild(div);

      // 화면 중앙 쯤에 오도록 조정: 타겟 Top - (화면높이 / 2) + (줄높이 / 2)
      // span.offsetTop은 div 내부에서의 상대 위치이므로 scrollTop과 1:1 대응됨 (padding 포함)
      textarea.scrollTop = Math.max(0, targetTop - (textarea.clientHeight / 2) + (lineHeight / 2));
    }
  };

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
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    전처리 전 텍스트
                  </CardTitle>
                  <CardDescription className="mt-1.5">
                    추출된 텍스트가 여기에 표시됩니다. 수정 후 전처리를 시작하세요
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Switch 
                    id="input-preview-mode"
                    checked={showPreview}
                    onCheckedChange={setShowPreview}
                    disabled={!inputText}
                  />
                  <Label htmlFor="input-preview-mode" className="text-sm cursor-pointer whitespace-nowrap">
                    미리보기
                  </Label>
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col space-y-4 min-h-0 overflow-hidden">
              {showPreview ? (
                <div 
                  ref={previewRef}
                  className="h-[600px] rounded-md border border-transparent hover:border-input hover:bg-muted/10 transition-colors bg-background px-4 py-3 text-sm ring-offset-background overflow-y-auto cursor-text group relative"
                  onClick={(e) => {
                    const target = e.target as HTMLElement;
                    // 클릭된 요소(또는 부모)에서 data-source-pos 찾기
                    const posElement = target.closest('[data-source-pos]') as HTMLElement;
                    const offsetStr = posElement?.getAttribute('data-source-pos');
                    let offset = offsetStr ? parseInt(offsetStr, 10) : undefined;

                    // 클릭한 위치의 정확한 오프셋 계산 (텍스트 노드 내부 위치)
                    if (offset !== undefined && posElement) {
                      // 표준 (Chrome, Safari, Edge 등)
                      if (document.caretRangeFromPoint) {
                        const range = document.caretRangeFromPoint(e.clientX, e.clientY);
                        if (range && posElement.contains(range.startContainer)) {
                           // posElement 시작부터 클릭된 위치까지의 텍스트 길이 계산
                           // range.startContainer는 클릭된 텍스트 노드일 수 있음
                           const preCaretRange = range.cloneRange();
                           preCaretRange.selectNodeContents(posElement);
                           preCaretRange.setEnd(range.startContainer, range.startOffset);
                           offset += preCaretRange.toString().length;
                        }
                      } 
                      // Firefox 등 (표준 호환)
                      else if ((document as any).caretPositionFromPoint) {
                         const pos = (document as any).caretPositionFromPoint(e.clientX, e.clientY);
                         if (pos && posElement.contains(pos.offsetNode)) {
                             const range = document.createRange();
                             range.selectNodeContents(posElement);
                             range.setEnd(pos.offsetNode, pos.offset);
                             offset += range.toString().length;
                         }
                      }
                    }

                    // 클릭된 요소의 텍스트 가져오기 (fallback)
                    let targetText = '';
                    
                    // 클릭한 요소가 텍스트를 포함하고 있으면 가져옴
                    if (target.innerText) {
                      targetText = target.innerText;
                    }
                    
                    setShowPreview(false);
                    
                    // 상태 변경 후 렌더링이 완료된 시점에 이동 (setTimeout)
                    setTimeout(() => {
                        jumpToTextPosition(targetText, offset);
                    }, 0);
                  }}
                  title="클릭하여 편집하기"
                >
                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-primary/10 text-primary text-xs px-2 py-1 rounded pointer-events-none font-medium">
                      클릭하여 편집
                    </div>
                    <ReactMarkdown 
                      remarkPlugins={[remarkGfm, addSourcePosPlugin]}
                      components={{
                        // 플러그인이 자동으로 data-source-pos를 주입하므로 개별 컴포넌트 설정 간소화
                        h1: ({...props}: any) => <h1 className="text-2xl font-bold mt-6 mb-4 scroll-m-20 border-b pb-2" {...props} />,
                        h2: ({...props}: any) => <h2 className="text-xl font-semibold mt-6 mb-3 scroll-m-20 border-b pb-2 first:mt-0" {...props} />,
                        h3: ({...props}: any) => <h3 className="text-lg font-semibold mt-4 mb-2 scroll-m-20" {...props} />,
                        h4: ({...props}: any) => <h4 className="text-base font-semibold mt-3 mb-2 scroll-m-20" {...props} />,
                        p: ({...props}: any) => <p className="leading-7 [&:not(:first-child)]:mt-4" {...props} />,
                        ul: ({...props}: any) => <ul className="my-4 ml-6 list-disc [&>li]:mt-2" {...props} />,
                        ol: ({...props}) => <ol className="my-4 ml-6 list-decimal [&>li]:mt-2" {...props} />,
                        li: ({...props}) => <li className="" {...props} />,
                        blockquote: ({...props}: any) => <blockquote className="mt-6 border-l-2 pl-6 italic text-muted-foreground" {...props} />,
                        img: ({...props}: any) => <img className="rounded-md border my-4 max-w-full" {...props} alt={props.alt || ''} />,
                        hr: ({...props}: any) => <hr className="my-4 border-muted" {...props} />,
                        table: ({...props}: any) => <div className="my-6 w-full overflow-y-auto"><table className="w-full border-collapse text-sm" {...props} /></div>,
                        tr: ({...props}: any) => <tr className="m-0 border-t p-0 even:bg-muted/50" {...props} />,
                        th: ({...props}: any) => <th className="border px-4 py-2 text-left font-bold [&[align=center]]:text-center [&[align=right]]:text-right bg-muted" {...props} />,
                        td: ({...props}: any) => <td className="border px-4 py-2 text-left [&[align=center]]:text-center [&[align=right]]:text-right" {...props} />,
                        code({inline, className, children, ...props}: any) {
                          return !inline ? (
                            <pre className="mb-4 mt-4 overflow-x-auto rounded-lg border bg-muted px-4 py-4 font-mono text-xs" {...props}>
                              <code className={className}>
                                {children}
                              </code>
                            </pre>
                          ) : (
                            <code className={`relative rounded bg-muted px-[0.3rem] py-[0.2rem] font-mono text-sm font-semibold ${className || ''}`} {...props}>
                              {children}
                            </code>
                          )
                        }
                      }}
                    >
                      {inputText}
                    </ReactMarkdown>
                </div>
              ) : (
                <Textarea
                  ref={textareaRef}
                  placeholder="추출된 텍스트가 여기에 표시됩니다..."
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  className="h-[600px] font-mono text-sm resize-none"
                  onBlur={() => {
                    // 편집 중 다른 곳 클릭 시 처리는 보류 (사용자 경험상 명시적 완료가 나을 수 있음)
                  }}
                />
              )}
              <div className="mt-auto space-y-3 shrink-0">
                {!showPreview && inputText && (
                   <Button variant="ghost" size="sm" onClick={handleEditComplete} className="w-full text-muted-foreground hover:text-foreground">
                     <CheckCircle2 className="mr-2 h-3 w-3" />
                     편집 완료 (미리보기)
                   </Button>
                )}
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
                <div className="h-[600px] overflow-hidden">
                  <ChunkFlowViewer chunks={processedChunks} />
                </div>
              ) : (
                <Textarea
                  placeholder="전처리된 결과가 여기에 표시됩니다..."
                  value={processedText}
                  onChange={(e) => setProcessedText(e.target.value)}
                  className="h-[600px] font-mono text-sm resize-none"
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
