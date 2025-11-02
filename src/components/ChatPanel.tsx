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
  status: 'pending' | 'approved' | 'declined';
}

interface PendingChanges {
  changes: PendingChange[];
  messageIndex: number;
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
  const [pendingChanges, setPendingChanges] = useState<PendingChanges | null>(null);
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

      const data = await response.json();
      const message = data.choices?.[0]?.message;
      
      if (!message) throw new Error('No message in response');

      let assistantContent = message.content || '';
      const collectedChanges: PendingChange[] = [];

      const handleToolCall = (toolCall: any) => {
        const functionName = toolCall.function?.name;
        const args = JSON.parse(toolCall.function?.arguments || '{}');

        const normalize = (s: any) => String(s || '').trim().toLowerCase();
        let targetNode = allNodes.find(n => n.id === args.nodeId);
        if (!targetNode && args.nodeLabel) {
          targetNode = allNodes.find(n => normalize((n as any).data?.label) === normalize(args.nodeLabel));
        }
        if (!targetNode && args.label) {
          targetNode = allNodes.find(n => normalize((n as any).data?.label) === normalize(args.label));
        }
        if (!targetNode) return;

        let changeDescription = '';
        let updates: any = {};

        switch (functionName) {
          case 'update_node_content':
            const existingContent = String((targetNode as any).data?.content || '');
            const appended = existingContent ? `${existingContent}\n\n${args.content}` : args.content;
            updates = { content: appended };
            changeDescription = `Append notes for "${String((targetNode as any).data.label)}"`;
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

        collectedChanges.push({
          nodeId: args.nodeId,
          nodeName: String(targetNode.data.label),
          changeType: functionName,
          updates,
          description: changeDescription,
          status: 'pending',
        });
      };

      // Handle tool calls if present
      if (message.tool_calls) {
        message.tool_calls.forEach((tc: any) => handleToolCall(tc));
      }

      // If we have changes, add them to pending and update message
      if (collectedChanges.length > 0) {
        assistantContent += `\n\n⏳ Waiting for approval (${collectedChanges.length} change${collectedChanges.length > 1 ? 's' : ''})`;
        setPendingChanges({
          changes: collectedChanges,
          messageIndex: messages.length + 1, // +1 because we're adding user and assistant messages
        });
        // Select first node to show its panel
        onNodeSelect(collectedChanges[0].nodeId);
      }

      // Add assistant message
      setMessages(prev => [...prev, { role: 'assistant', content: assistantContent }]);
      setIsLoading(false);
    } catch (error) {
      console.error('Chat error:', error);
      toast.error('Failed to send message');
      setIsLoading(false);
    }
  };

  const handleApproveChange = (index: number) => {
    if (!pendingChanges) return;
    
    const updatedChanges = [...pendingChanges.changes];
    updatedChanges[index].status = 'approved';
    setPendingChanges({ ...pendingChanges, changes: updatedChanges });
  };

  const handleDeclineChange = (index: number) => {
    if (!pendingChanges) return;
    
    const updatedChanges = [...pendingChanges.changes];
    updatedChanges[index].status = 'declined';
    setPendingChanges({ ...pendingChanges, changes: updatedChanges });
  };

  const handleApproveAll = () => {
    if (!pendingChanges) return;
    const updatedChanges = pendingChanges.changes.map(c => ({ ...c, status: 'approved' as const }));
    setPendingChanges({ ...pendingChanges, changes: updatedChanges });
  };

  const handleDeclineAll = () => {
    if (!pendingChanges) return;
    const updatedChanges = pendingChanges.changes.map(c => ({ ...c, status: 'declined' as const }));
    setPendingChanges({ ...pendingChanges, changes: updatedChanges });
  };

  const handleApplyChanges = () => {
    if (!pendingChanges) return;
    
    const approvedChanges = pendingChanges.changes.filter(c => c.status === 'approved');
    const declinedChanges = pendingChanges.changes.filter(c => c.status === 'declined');
    
    // Apply approved changes
    approvedChanges.forEach(change => {
      onNodeUpdate(change.nodeId, change.updates);
    });
    
    // Build detailed status message showing which nodes were updated
    let statusText = '';
    
    if (approvedChanges.length > 0) {
      const changesByNode = approvedChanges.reduce((acc, change) => {
        if (!acc[change.nodeName]) acc[change.nodeName] = [];
        acc[change.nodeName].push(change.description.replace(/^.*"([^"]+)".*$/, '$1'));
        return acc;
      }, {} as Record<string, string[]>);
      
      const nodeSummaries = Object.entries(changesByNode).map(([nodeName, changes]) => 
        `  • **${nodeName}**: ${changes.join(', ')}`
      ).join('\n');
      
      statusText = `✓ **Applied ${approvedChanges.length} change${approvedChanges.length !== 1 ? 's' : ''}:**\n${nodeSummaries}`;
    }
    
    if (declinedChanges.length > 0) {
      if (statusText) statusText += '\n\n';
      statusText += `✗ Declined ${declinedChanges.length} change${declinedChanges.length !== 1 ? 's' : ''}`;
    }
    
    if (!statusText) {
      statusText = '✗ No changes applied';
    }
    
    setMessages(prev => prev.map((m, i) => 
      i === pendingChanges.messageIndex 
        ? { ...m, content: m.content.replace(/⏳ Waiting for approval.*/, statusText) }
        : m
    ));
    
    if (approvedChanges.length > 0) {
      toast.success(`Applied ${approvedChanges.length} change${approvedChanges.length !== 1 ? 's' : ''}`);
    }
    setPendingChanges(null);
  };

  const hasDecisions = pendingChanges?.changes.some(c => c.status !== 'pending') || false;

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

    <AlertDialog open={!!pendingChanges} onOpenChange={() => {}}>
      <AlertDialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <AlertDialogHeader className="flex-shrink-0">
          <AlertDialogTitle>
            Review AI Changes ({pendingChanges?.changes.length || 0} change{pendingChanges?.changes.length !== 1 ? 's' : ''})
          </AlertDialogTitle>
          <AlertDialogDescription>
            Approve or decline each change individually:
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="flex-1 overflow-hidden">
          <ScrollArea className="h-full pr-4">
            <div className="space-y-3 py-2">
              {pendingChanges?.changes.map((change, idx) => (
                <div 
                  key={idx} 
                  className={`p-4 rounded-lg border transition-all ${
                    change.status === 'approved' ? 'bg-green-500/10 border-green-500/50' :
                    change.status === 'declined' ? 'bg-red-500/10 border-red-500/50' :
                    'bg-muted border-border'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium mb-1">{change.description}</p>
                      {change.updates.content && (
                        <p className="text-xs text-muted-foreground mt-2 line-clamp-3 bg-background/50 p-2 rounded">
                          {change.updates.content}
                        </p>
                      )}
                      {change.updates.links && (
                        <p className="text-xs text-muted-foreground mt-2">
                          Adding {change.updates.links.length - (change.updates.links.length - 1)} link(s)
                        </p>
                      )}
                    </div>
                    <div className="flex gap-1 flex-shrink-0">
                      {change.status === 'pending' ? (
                        <>
                          <Button 
                            variant="outline" 
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleDeclineChange(idx)}
                          >
                            <X className="w-4 h-4 text-red-500" />
                          </Button>
                          <Button 
                            variant="outline" 
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleApproveChange(idx)}
                          >
                            <Check className="w-4 h-4 text-green-500" />
                          </Button>
                        </>
                      ) : (
                        <div className="h-8 w-16 flex items-center justify-center text-xs font-medium">
                          {change.status === 'approved' ? '✓ Yes' : '✗ No'}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
        <div className="flex gap-2 justify-between pt-4 border-t flex-shrink-0">
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="sm"
              onClick={handleApproveAll}
            >
              <Check className="w-4 h-4 mr-1" />
              Accept All
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={handleDeclineAll}
            >
              <X className="w-4 h-4 mr-1" />
              Deny All
            </Button>
          </div>
          <Button 
            onClick={handleApplyChanges}
            disabled={!hasDecisions}
          >
            Apply Decisions
          </Button>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  </>
  );
};
