import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Sparkles, FileText } from 'lucide-react';
import { Button } from './ui/button';

interface CustomNodeProps {
  data: {
    label: string;
    content?: string;
    color?: string;
    diagramType?: string;
    onOpenPanel?: (node: any) => void;
    onSelectForAI?: (node: any) => void;
  };
  id: string;
}

export const MindMapNode = memo(({ data, id }: CustomNodeProps) => {
  const handleClick = () => {
    if (data.onSelectForAI) {
      data.onSelectForAI({ id, data, position: { x: 0, y: 0 }, type: 'custom' });
    }
  };

  const handleOpenPanel = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (data.onOpenPanel) {
      data.onOpenPanel({ id, data, position: { x: 0, y: 0 }, type: 'custom' });
    }
  };

  const handleAIClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (data.onSelectForAI) {
      data.onSelectForAI({ id, data, position: { x: 0, y: 0 }, type: 'custom' });
    }
  };

  const nodeStyle = data.color ? {
    borderColor: data.color,
    boxShadow: `0 4px 20px ${data.color}30, 0 0 40px ${data.color}15`
  } : {};

  return (
    <div
      className="px-5 py-3 rounded-xl border-2 bg-card shadow-lg hover:shadow-2xl transition-all duration-300 min-w-[140px] max-w-[200px] cursor-pointer group hover:scale-110 relative backdrop-blur-sm"
      style={nodeStyle}
      onClick={handleClick}
    >
      <Handle
        type="target"
        position={Position.Top}
        id="top"
        className="w-3 h-3 !bg-accent border-2 border-card opacity-0 group-hover:opacity-100 transition-opacity"
      />
      <Handle
        type="source"
        position={Position.Top}
        id="top"
        className="w-3 h-3 !bg-primary border-2 border-card opacity-0 group-hover:opacity-100 transition-opacity"
      />
      
      <Handle
        type="target"
        position={Position.Left}
        id="left"
        className="w-3 h-3 !bg-accent border-2 border-card opacity-0 group-hover:opacity-100 transition-opacity"
      />
      <Handle
        type="source"
        position={Position.Left}
        id="left"
        className="w-3 h-3 !bg-primary border-2 border-card opacity-0 group-hover:opacity-100 transition-opacity"
      />
      
      {/* Action buttons - shown on hover */}
      <div className="absolute -top-2 -right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
        <Button
          size="icon"
          variant="secondary"
          className="h-6 w-6 rounded-full shadow-lg"
          onClick={handleAIClick}
        >
          <Sparkles className="h-3 w-3" />
        </Button>
        <Button
          size="icon"
          variant="secondary"
          className="h-6 w-6 rounded-full shadow-lg"
          onClick={handleOpenPanel}
        >
          <FileText className="h-3 w-3" />
        </Button>
      </div>

      <div className="text-center">
        <div className="font-semibold text-sm text-foreground transition-colors leading-tight">
          {data.label}
        </div>
        {data.content && (
          <div className="text-[11px] text-muted-foreground line-clamp-2 mt-1.5 leading-snug">
            {data.content}
          </div>
        )}
      </div>

      <Handle
        type="target"
        position={Position.Right}
        id="right"
        className="w-3 h-3 !bg-accent border-2 border-card opacity-0 group-hover:opacity-100 transition-opacity"
      />
      <Handle
        type="source"
        position={Position.Right}
        id="right"
        className="w-3 h-3 !bg-primary border-2 border-card opacity-0 group-hover:opacity-100 transition-opacity"
      />
      
      <Handle
        type="target"
        position={Position.Bottom}
        id="bottom"
        className="w-3 h-3 !bg-accent border-2 border-card opacity-0 group-hover:opacity-100 transition-opacity"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="bottom"
        className="w-3 h-3 !bg-primary border-2 border-card opacity-0 group-hover:opacity-100 transition-opacity"
      />
    </div>
  );
});

MindMapNode.displayName = 'MindMapNode';
