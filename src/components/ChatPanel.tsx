import { useState, useRef, useEffect } from 'react';
import { Node } from '@xyflow/react';
import { Send, Bot, User, Loader2, Check, X } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { ScrollArea } from './ui/scroll-area';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from './ui/alert-dialog';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface PendingChange {
  nodeId: string;
  nodeName: string;
  changeType: string;
  updates: any;
  description: string;
}

interface ChatPanelProps {
  isOpen: boolean;
  node: Node | null;
  allNodes: Node[];
  onNodeUpdate: (nodeId: string, updates: any) => void;
  onNodeSelect: (nodeId: string) => void;
}

export const ChatPanel = ({ isOpen, node, allNodes, onNodeUpdate, onNodeSelect }: ChatPanelProps) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [pendingChange, setPendingChange] = useState<PendingChange | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/node-chat`;

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch(CHAT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ 
          messages: [...messages, userMessage],
          allNodes: allNodes.map(n => ({
            id: n.id,
            label: n.data.label,
            content: n.data.content,
            links: n.data.links,
            images: n.data.images,
            documents: n.data.documents,
          }))
        }),
      });

      if (!response.ok) {
        if (response.status === 429) {
          toast.error('Rate limit exceeded. Please try again later.');
        } else if (response.status === 402) {
          toast.error('Payment required. Please add funds to continue.');
        } else {
          toast.error('Failed to get response from AI');
        }
        setIsLoading(false);
        return;
      }

      if (!response.body) throw new Error('No response body');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = '';
      let assistantContent = '';

      const updateAssistant = (chunk: string) => {
        assistantContent += chunk;
        setMessages(prev => {
          const last = prev[prev.length - 1];
          if (last?.role === 'assistant') {
            return prev.map((m, i) => 
              i === prev.length - 1 ? { ...m, content: assistantContent } : m
            );
          }
          return [...prev, { role: 'assistant', content: assistantContent }];
        });
      };

      const handleToolCall = (toolCall: any) => {
        const functionName = toolCall.function?.name;
        const args = JSON.parse(toolCall.function?.arguments || '{}');

        const targetNode = allNodes.find(n => n.id === args.nodeId);
        if (!targetNode) return;

        let changeDescription = '';
        let updates: any = {};

        switch (functionName) {
          case 'update_node_content':
            updates = { content: args.content };
            changeDescription = `Update content for "${String(targetNode.data.label)}"`;
            break;
          case 'update_node_label':
            updates = { label: args.label };
            changeDescription = `Change label from "${String(targetNode.data.label)}" to "${args.label}"`;
            break;
          case 'add_node_link':
            const currentLinks = targetNode.data.links || [];
            const newLink = { url: args.url, title: args.title || args.url };
            updates = { links: [...(currentLinks as any[]), newLink] };
            changeDescription = `Add link "${args.title || args.url}" to "${String(targetNode.data.label)}"`;
            break;
          case 'add_node_image':
            const currentImages = targetNode.data.images || [];
            updates = { images: [...(currentImages as any[]), { url: args.url }] };
            changeDescription = `Add image to "${String(targetNode.data.label)}"`;
            break;
        }

        // Show pending change for approval
        setPendingChange({
          nodeId: args.nodeId,
          nodeName: String(targetNode.data.label),
          changeType: functionName,
          updates,
          description: changeDescription,
        });

        // Select the node to show its panel
        onNodeSelect(args.nodeId);

        updateAssistant(`\n\n⏳ Waiting for approval: ${changeDescription}`);
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        textBuffer += decoder.decode(value, { stream: true });
        
        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf('\n')) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);
          
          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (line.startsWith(':') || line.trim() === '') continue;
          if (!line.startsWith('data: ')) continue;
          
          const jsonStr = line.slice(6).trim();
          if (jsonStr === '[DONE]') break;
          
          try {
            const parsed = JSON.parse(jsonStr);
            const delta = parsed.choices?.[0]?.delta;
            
            if (delta?.content) {
              updateAssistant(delta.content);
            }
            
            if (delta?.tool_calls) {
              delta.tool_calls.forEach((tc: any) => handleToolCall(tc));
            }
          } catch {
            textBuffer = line + '\n' + textBuffer;
            break;
          }
        }
      }

      setIsLoading(false);
    } catch (error) {
      console.error('Chat error:', error);
      toast.error('Failed to send message');
      setIsLoading(false);
    }
  };

  const handleApprove = () => {
    if (!pendingChange) return;
    
    onNodeUpdate(pendingChange.nodeId, pendingChange.updates);
    
    setMessages(prev => {
      const last = prev[prev.length - 1];
      if (last?.role === 'assistant') {
        return prev.map((m, i) => 
          i === prev.length - 1 
            ? { ...m, content: m.content.replace('⏳ Waiting for approval:', '✓ Applied:') }
            : m
        );
      }
      return prev;
    });
    
    toast.success(`Applied changes to "${pendingChange.nodeName}"`);
    setPendingChange(null);
  };

  const handleDecline = () => {
    if (!pendingChange) return;
    
    setMessages(prev => {
      const last = prev[prev.length - 1];
      if (last?.role === 'assistant') {
        return prev.map((m, i) => 
          i === prev.length - 1 
            ? { ...m, content: m.content.replace('⏳ Waiting for approval:', '✗ Declined:') }
            : m
        );
      }
      return prev;
    });
    
    toast.info(`Declined changes to "${pendingChange.nodeName}"`);
    setPendingChange(null);
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed left-0 top-0 h-full w-full md:w-96 bg-card border-r border-border shadow-2xl z-50 flex flex-col animate-slide-in">
      {/* Header */}
      <div className="flex items-center gap-3 p-6 border-b border-border">
        <Bot className="w-6 h-6 text-primary" />
        <div>
          <h2 className="text-xl font-bold text-foreground">AI Assistant</h2>
          <p className="text-xs text-muted-foreground">
            Working with {allNodes.length} node{allNodes.length !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-6" ref={scrollRef}>
        <div className="space-y-4">
          {messages.length === 0 && (
            <div className="text-center text-muted-foreground py-8">
              <Bot className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p className="text-sm">Start a conversation to get help with your ideas!</p>
            </div>
          )}
          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {msg.role === 'assistant' && (
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Bot className="w-4 h-4 text-primary" />
                </div>
              )}
              <div
                className={`max-w-[80%] rounded-lg p-3 ${
                  msg.role === 'user'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted'
                }`}
              >
                <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
              </div>
              {msg.role === 'user' && (
                <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                  <User className="w-4 h-4 text-primary-foreground" />
                </div>
              )}
            </div>
          ))}
          {isLoading && (
            <div className="flex gap-3 justify-start">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Bot className="w-4 h-4 text-primary" />
              </div>
              <div className="bg-muted rounded-lg p-3">
                <Loader2 className="w-4 h-4 animate-spin" />
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="p-6 border-t border-border">
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
            placeholder="Ask about your notes..."
            disabled={isLoading}
          />
          <Button onClick={sendMessage} disabled={isLoading || !input.trim()}>
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </Button>
        </div>
      </div>
    </div>

    <AlertDialog open={!!pendingChange} onOpenChange={() => {}}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Approve AI Edit</AlertDialogTitle>
          <AlertDialogDescription>
            {pendingChange?.description}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={handleDecline} size="lg">
            <X className="w-5 h-5 mr-2" />
            Decline
          </Button>
          <Button onClick={handleApprove} size="lg">
            <Check className="w-5 h-5 mr-2" />
            Approve
          </Button>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  </>
  );
};
