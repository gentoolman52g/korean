import React from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface ChunkFlowViewerProps {
  chunks: string[];
}

export function ChunkFlowViewer({ chunks }: ChunkFlowViewerProps) {
  if (!chunks || chunks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-8 text-center border-2 border-dashed rounded-lg bg-muted/10">
        <p>생성된 청크가 없습니다.</p>
        <p className="text-sm mt-2">전처리를 먼저 진행해주세요.</p>
      </div>
    );
  }

  // 시각적 구분을 위한 파스텔 톤 색상 팔레트
  const chunkColors = [
    'bg-blue-100 dark:bg-blue-900/30 text-blue-900 dark:text-blue-100 border-blue-200 dark:border-blue-800',
    'bg-green-100 dark:bg-green-900/30 text-green-900 dark:text-green-100 border-green-200 dark:border-green-800',
    'bg-amber-100 dark:bg-amber-900/30 text-amber-900 dark:text-amber-100 border-amber-200 dark:border-amber-800',
    'bg-purple-100 dark:bg-purple-900/30 text-purple-900 dark:text-purple-100 border-purple-200 dark:border-purple-800',
  ];

  return (
    <ScrollArea className="h-full w-full rounded-md border bg-background">
      <div className="p-4 flex flex-col leading-relaxed text-sm">
        {chunks.map((chunk, index) => {
          const colorClass = chunkColors[index % chunkColors.length];
          
          return (
            <div 
              key={index} 
              className={`relative group px-4 py-2 border-b last:border-0 ${colorClass} transition-all hover:brightness-95`}
            >
              {/* 호버 시 뱃지 표시 */}
              <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-10 pointer-events-none">
                <Badge variant="outline" className="text-[10px] h-4 px-1 bg-background shadow-sm whitespace-nowrap">
                  #{index + 1}
                </Badge>
              </div>
              
              <ReactMarkdown 
                remarkPlugins={[remarkGfm]}
                components={{
                  h1: ({...props}: any) => <h1 className="text-2xl font-bold mt-4 mb-2 border-b pb-2 first:mt-0" {...props} />,
                  h2: ({...props}: any) => <h2 className="text-xl font-semibold mt-4 mb-2 border-b pb-2 first:mt-0" {...props} />,
                  h3: ({...props}: any) => <h3 className="text-lg font-semibold mt-3 mb-2" {...props} />,
                  h4: ({...props}: any) => <h4 className="text-base font-semibold mt-2 mb-1" {...props} />,
                  p: ({...props}: any) => <p className="leading-7 [&:not(:first-child)]:mt-2" {...props} />,
                  ul: ({...props}: any) => <ul className="my-2 ml-6 list-disc [&>li]:mt-1" {...props} />,
                  ol: ({...props}: any) => <ol className="my-2 ml-6 list-decimal [&>li]:mt-1" {...props} />,
                  li: ({...props}: any) => <li className="" {...props} />,
                  blockquote: ({...props}: any) => <blockquote className="mt-2 border-l-2 pl-4 italic text-muted-foreground" {...props} />,
                  img: ({...props}: any) => <img className="rounded-md border my-2 max-w-full" {...props} alt={props.alt || ''} />,
                  hr: ({...props}: any) => <hr className="my-4 border-muted" {...props} />,
                  table: ({...props}: any) => <div className="my-4 w-full overflow-y-auto"><table className="w-full border-collapse text-sm" {...props} /></div>,
                  tr: ({...props}: any) => <tr className="m-0 border-t p-0 even:bg-muted/50" {...props} />,
                  th: ({...props}: any) => <th className="border px-4 py-2 text-left font-bold [&[align=center]]:text-center [&[align=right]]:text-right bg-muted/50" {...props} />,
                  td: ({...props}: any) => <td className="border px-4 py-2 text-left [&[align=center]]:text-center [&[align=right]]:text-right" {...props} />,
                  code({inline, className, children, ...props}: any) {
                    return !inline ? (
                      <pre className="mb-2 mt-2 overflow-x-auto rounded-lg border bg-muted/50 px-4 py-3 font-mono text-xs" {...props}>
                        <code className={className}>
                          {children}
                        </code>
                      </pre>
                    ) : (
                      <code className={`relative rounded bg-muted/50 px-[0.3rem] py-[0.2rem] font-mono text-sm font-semibold ${className || ''}`} {...props}>
                        {children}
                      </code>
                    )
                  }
                }}
              >
                {chunk}
              </ReactMarkdown>
            </div>
          );
        })}
      </div>
    </ScrollArea>
  );
}
