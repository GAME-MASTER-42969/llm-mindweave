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
      className="px-4 py-2 rounded-lg border-2 border-primary/50 bg-card shadow-md hover:shadow-lg transition-all duration-300 min-w-[120px] max-w-[180px] cursor-pointer group hover:scale-105"
      onClick={handleClick}
    >
      <Handle
        type="target"
        position={Position.Top}
        id="top-target"
        className="w-2 h-2 !bg-accent border-2 border-background"
      />
      <Handle
        type="source"
        position={Position.Top}
        id="top-source"
        className="w-2 h-2 !bg-accent border-2 border-background"
      />
      
      <Handle
        type="target"
        position={Position.Left}
        id="left-target"
        className="w-2 h-2 !bg-accent border-2 border-background"
      />
      <Handle
        type="source"
        position={Position.Left}
        id="left-source"
        className="w-2 h-2 !bg-accent border-2 border-background"
      />
      
      <div className="text-center">
        <div className="font-medium text-sm text-foreground group-hover:text-primary transition-colors">
          {data.label}
        </div>
        {data.content && (
          <div className="text-[10px] text-muted-foreground line-clamp-2 mt-0.5">
            {data.content}
          </div>
        )}
      </div>

      <Handle
        type="target"
        position={Position.Right}
        id="right-target"
        className="w-2 h-2 !bg-accent border-2 border-background"
      />
      <Handle
        type="source"
        position={Position.Right}
        id="right-source"
        className="w-2 h-2 !bg-accent border-2 border-background"
      />
      
      <Handle
        type="target"
        position={Position.Bottom}
        id="bottom-target"
        className="w-2 h-2 !bg-accent border-2 border-background"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="bottom-source"
        className="w-2 h-2 !bg-accent border-2 border-background"
      />
    </div>
  );
});

MindMapNode.displayName = 'MindMapNode';
