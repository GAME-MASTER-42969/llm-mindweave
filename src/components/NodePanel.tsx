import { useState, useEffect } from 'react';
import { Node } from '@xyflow/react';
import { X, Trash2, Save } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Label } from './ui/label';

interface NodePanelProps {
  node: Node | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: (nodeId: string, updates: { label?: string; content?: string }) => void;
  onDelete: (nodeId: string) => void;
}

export const NodePanel = ({ node, isOpen, onClose, onUpdate, onDelete }: NodePanelProps) => {
  const [label, setLabel] = useState('');
  const [content, setContent] = useState('');

  useEffect(() => {
    if (node) {
      setLabel(String(node.data.label || ''));
      setContent(String(node.data.content || ''));
    }
  }, [node]);

  const handleSave = () => {
    if (node) {
      onUpdate(node.id, { label, content });
    }
  };

  const handleDelete = () => {
    if (node && confirm('Are you sure you want to delete this node?')) {
      onDelete(node.id);
    }
  };

  if (!isOpen || !node) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-background/50 backdrop-blur-sm z-40 animate-fade-in"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed right-0 top-0 h-full w-full md:w-96 bg-card border-l border-border shadow-2xl z-50 animate-slide-in flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <h2 className="text-xl font-bold text-foreground">Node Details</h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="space-y-2">
            <Label htmlFor="label">Title</Label>
            <Input
              id="label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Node title"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="content">Content</Label>
            <Textarea
              id="content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Add your notes, references, or documents here..."
              className="min-h-[300px] resize-none"
            />
          </div>

          <div className="text-xs text-muted-foreground">
            <p>Use this space to add:</p>
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>Notes and ideas</li>
              <li>References and links</li>
              <li>Documents and files</li>
              <li>Any relevant information</li>
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-border flex gap-2">
          <Button onClick={handleSave} className="flex-1 gap-2">
            <Save className="w-4 h-4" />
            Save Changes
          </Button>
          <Button onClick={handleDelete} variant="destructive" size="icon">
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </>
  );
};
