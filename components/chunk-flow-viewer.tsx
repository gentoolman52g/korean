import React from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';

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
      <div className="p-4 flex flex-wrap gap-1 leading-relaxed font-mono text-sm">
        {chunks.map((chunk, index) => {
          const colorClass = chunkColors[index % chunkColors.length];
          
          return (
            <span 
              key={index} 
              className={`relative inline group px-1 py-0.5 rounded border ${colorClass} transition-all hover:brightness-95`}
              title={`Chunk #${index + 1} (${chunk.length}자)`}
            >
              {/* 호버 시 뱃지 표시 */}
              <span className="absolute -top-3 left-0 opacity-0 group-hover:opacity-100 transition-opacity z-10 pointer-events-none">
                <Badge variant="outline" className="text-[10px] h-4 px-1 bg-background shadow-sm whitespace-nowrap">
                  #{index + 1}
                </Badge>
              </span>
              {chunk}
            </span>
          );
        })}
      </div>
    </ScrollArea>
  );
}

