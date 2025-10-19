import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';

interface CustomNodeProps {
  data: {
    label: string;
    content?: string;
    color?: string;
    onOpenPanel?: (node: any) => void;
  };
  id: string;
}

export const MindMapNode = memo(({ data, id }: CustomNodeProps) => {
  const handleClick = () => {
    if (data.onOpenPanel) {
      data.onOpenPanel({ id, data, position: { x: 0, y: 0 }, type: 'custom' });
    }
  };

  return (
    <div
      className="px-6 py-4 rounded-xl border-2 border-primary/50 bg-card shadow-lg hover:shadow-xl transition-all duration-300 min-w-[150px] cursor-pointer group hover:scale-105 animate-pulse-glow"
      onClick={handleClick}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="w-3 h-3 !bg-accent border-2 border-background"
      />
      
      <div className="text-center">
        <div className="font-semibold text-foreground mb-1 group-hover:text-primary transition-colors">
          {data.label}
        </div>
        {data.content && (
          <div className="text-xs text-muted-foreground line-clamp-2">
            {data.content}
          </div>
        )}
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        className="w-3 h-3 !bg-accent border-2 border-background"
      />
    </div>
  );
});

MindMapNode.displayName = 'MindMapNode';
