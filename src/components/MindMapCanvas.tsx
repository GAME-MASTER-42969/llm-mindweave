import { useCallback, useEffect, useState } from 'react';
import { ReactFlow, Background, Controls, MiniMap, addEdge, useNodesState, useEdgesState, Connection, Node, Edge, BackgroundVariant, useReactFlow, ReactFlowProvider } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { supabase } from '@/integrations/supabase/client';
import { MindMapNode } from './MindMapNode';
import { NodePanel } from './NodePanel';
import { Button } from './ui/button';
import { Plus, Sparkles, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Input } from './ui/input';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from './ui/alert-dialog';
const nodeTypes = {
  custom: MindMapNode
};
interface MindMapCanvasInnerProps {
  mindMapId: string;
  onNodePanelChange?: (node: Node | null, isOpen: boolean) => void;
}

const MindMapCanvasInner = ({
  mindMapId,
  onNodePanelChange
}: MindMapCanvasInnerProps) => {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [isAddNodeMode, setIsAddNodeMode] = useState(false);
  const [isAiToolbarDismissed, setIsAiToolbarDismissed] = useState(false);
  const {
    screenToFlowPosition
  } = useReactFlow();

  // Load nodes and edges
  useEffect(() => {
    loadMindMap();
  }, [mindMapId]);

  // Hotkey for add node mode
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === '1' && !isGenerating && !isPanelOpen) {
        setIsAddNodeMode(prev => !prev);
      }
      if (e.key === 'Escape' && isAddNodeMode) {
        setIsAddNodeMode(false);
      }
    };
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [isAddNodeMode, isGenerating, isPanelOpen]);
  const loadMindMap = async () => {
    const {
      data: nodesData
    } = await supabase.from('nodes').select('*').eq('mind_map_id', mindMapId);
    const {
      data: edgesData
    } = await supabase.from('edges').select('*').eq('mind_map_id', mindMapId);
    if (nodesData) {
      const flowNodes = nodesData.map(node => ({
        id: node.id,
        type: 'custom',
        position: {
          x: node.position_x,
          y: node.position_y
        },
        data: {
          label: node.label,
          content: node.content,
          color: node.color,
          onOpenPanel: (node: Node) => {
            setSelectedNode(node);
            setIsPanelOpen(true);
            onNodePanelChange?.(node, true);
          },
          onSelectForAI: (node: Node) => {
            setSelectedNode(node);
            setIsPanelOpen(false);
            onNodePanelChange?.(node, false);
            setIsAiToolbarDismissed(false);
          }
        }
      }));
      setNodes(flowNodes);
    }
    if (edgesData) {
      const flowEdges = edgesData.map((edge: any) => ({
        id: edge.id,
        source: edge.source_node_id,
        target: edge.target_node_id,
        sourceHandle: edge.source_handle || undefined,
        targetHandle: edge.target_handle || undefined,
        type: 'smoothstep',
        animated: true,
        style: {
          stroke: 'hsl(var(--accent))',
          strokeWidth: 2
        }
      }));
      setEdges(flowEdges);
    }
  };
  const onConnect = useCallback(async (connection: Connection) => {
    const {
      data: user
    } = await supabase.auth.getUser();
    if (!user.user) return;
    const newEdge: Edge = {
      id: `${connection.source}-${connection.target}`,
      source: connection.source!,
      target: connection.target!,
      sourceHandle: connection.sourceHandle || undefined,
      targetHandle: connection.targetHandle || undefined,
      type: 'smoothstep',
      animated: true,
      style: {
        stroke: 'hsl(var(--accent))',
        strokeWidth: 2
      }
    };
    const {
      error
    } = await supabase.from('edges').insert({
      mind_map_id: mindMapId,
      source_node_id: connection.source,
      target_node_id: connection.target,
      source_handle: connection.sourceHandle,
      target_handle: connection.targetHandle,
      user_id: user.user.id
    });
    if (error) {
      toast.error('Failed to create connection');
      return;
    }
    setEdges(eds => addEdge(newEdge, eds));
    toast.success('Connection created');
  }, [mindMapId, setEdges]);
  const onConnectEnd = useCallback(async (event: any, connectionState: any) => {
    // If no target node, create a new node
    if (!connectionState.toNode) {
      const {
        data: user
      } = await supabase.auth.getUser();
      if (!user.user) return;

      // Get mouse position relative to the flow
      const targetIsPane = event.target.classList.contains('react-flow__pane');
      if (!targetIsPane) return;
      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY
      });
      const newNode = {
        mind_map_id: mindMapId,
        user_id: user.user.id,
        label: 'New Node',
        content: 'Add your notes here...',
        position_x: position.x,
        position_y: position.y
      };
      const {
        data,
        error
      } = await supabase.from('nodes').insert(newNode).select().single();
      if (error || !data) {
        toast.error('Failed to create node');
        return;
      }
      const flowNode: Node = {
        id: data.id,
        type: 'custom',
        position: {
          x: data.position_x,
          y: data.position_y
        },
        data: {
          label: data.label,
          content: data.content,
          color: data.color,
          onOpenPanel: (node: Node) => {
            setSelectedNode(node);
            setIsPanelOpen(true);
            onNodePanelChange?.(node, true);
          },
          onSelectForAI: (node: Node) => {
            setSelectedNode(node);
            setIsPanelOpen(false);
            onNodePanelChange?.(node, false);
            setIsAiToolbarDismissed(false);
          }
        }
      };
      setNodes(nds => [...nds, flowNode]);

      // Create edge from source to new node
      if (connectionState.fromNode) {
        const newEdge: Edge = {
          id: `${connectionState.fromNode.id}-${data.id}`,
          source: connectionState.fromNode.id,
          target: data.id,
          sourceHandle: connectionState.fromHandle?.id || undefined,
          targetHandle: undefined,
          type: 'smoothstep',
          animated: true,
          style: {
            stroke: 'hsl(var(--accent))',
            strokeWidth: 2
          }
        };
        const {
          error: edgeError
        } = await supabase.from('edges').insert({
          mind_map_id: mindMapId,
          source_node_id: connectionState.fromNode.id,
          target_node_id: data.id,
          source_handle: connectionState.fromHandle?.id,
          target_handle: null,
          user_id: user.user.id
        });
        if (!edgeError) {
          setEdges(eds => addEdge(newEdge, eds));
        }
      }
      toast.success('Node created');
    }
  }, [mindMapId, screenToFlowPosition, setNodes, setEdges]);
  const onNodeDragStop = async (_: any, node: Node) => {
    await supabase.from('nodes').update({
      position_x: node.position.x,
      position_y: node.position.y
    }).eq('id', node.id);
  };
  const addNewNode = async (position?: { x: number; y: number }) => {
    const {
      data: user
    } = await supabase.auth.getUser();
    if (!user.user) return;
    
    const pos = position || { x: Math.random() * 500, y: Math.random() * 500 };
    
    const newNode = {
      mind_map_id: mindMapId,
      user_id: user.user.id,
      label: 'New Node',
      content: 'Add your notes here...',
      position_x: pos.x,
      position_y: pos.y
    };
    const {
      data,
      error
    } = await supabase.from('nodes').insert(newNode).select().single();
    if (error) {
      toast.error('Failed to create node');
      return;
    }
    const flowNode = {
      id: data.id,
      type: 'custom',
      position: {
        x: data.position_x,
        y: data.position_y
      },
      data: {
        label: data.label,
        content: data.content,
        onOpenPanel: (node: Node) => {
          setSelectedNode(node);
          setIsPanelOpen(true);
          onNodePanelChange?.(node, true);
        },
        onSelectForAI: (node: Node) => {
          setSelectedNode(node);
          setIsPanelOpen(false);
          onNodePanelChange?.(node, false);
          setIsAiToolbarDismissed(false);
        }
      }
    };
    setNodes(nds => [...nds, flowNode]);
    toast.success('Node created');
  };

  const onPaneClick = (event: React.MouseEvent) => {
    if (isAddNodeMode) {
      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY
      });
      addNewNode(position);
      setIsAddNodeMode(false);
    }
  };
  const generateWithAI = async () => {
    if (!aiPrompt.trim()) {
      toast.error('Please enter a prompt');
      return;
    }
    setIsGenerating(true);
    try {
      const {
        data: user
      } = await supabase.auth.getUser();
      if (!user.user) return;
      const {
        data,
        error
      } = await supabase.functions.invoke('generate-node', {
        body: {
          prompt: aiPrompt,
          context: selectedNode?.data.label,
          baseX: selectedNode ? selectedNode.position.x : 0,
          baseY: selectedNode ? selectedNode.position.y : 0
        }
      });
      if (error) throw error;
      const diagramType = data.diagramType || 'network';
      const nodesData = data.nodes || [];
      console.log(`Creating ${diagramType} diagram with ${nodesData.length} nodes`);

      // Assign colors based on diagram type and node hierarchy
      const getNodeColor = (index: number, total: number) => {
        const colorSchemes = {
          hierarchical: ['hsl(260, 80%, 60%)', 'hsl(240, 70%, 55%)', 'hsl(220, 60%, 50%)', 'hsl(200, 50%, 45%)'],
          radial: ['hsl(260, 80%, 60%)', 'hsl(190, 80%, 60%)', 'hsl(150, 70%, 55%)', 'hsl(280, 70%, 60%)'],
          linear: ['hsl(260, 80%, 60%)', 'hsl(240, 75%, 58%)', 'hsl(220, 70%, 56%)', 'hsl(200, 65%, 54%)'],
          network: ['hsl(260, 80%, 60%)', 'hsl(190, 80%, 60%)', 'hsl(280, 70%, 60%)', 'hsl(150, 70%, 55%)'],
          matrix: ['hsl(260, 80%, 60%)', 'hsl(190, 80%, 60%)', 'hsl(280, 70%, 60%)', 'hsl(150, 70%, 55%)']
        };
        const scheme = colorSchemes[diagramType as keyof typeof colorSchemes] || colorSchemes.network;
        return scheme[index % scheme.length];
      };

      // Create nodes using AI-specified positions (already calculated relative to base)
      const insertPromises = nodesData.map((nodeData: any, index: number) => {
        return supabase.from('nodes').insert({
          mind_map_id: mindMapId,
          user_id: user.user.id,
          label: nodeData.label,
          content: nodeData.content,
          position_x: nodeData.x || 0,
          position_y: nodeData.y || 0,
          color: getNodeColor(index, nodesData.length)
        }).select().single();
      });
      const results = await Promise.all(insertPromises);
      const createdNodes = results.filter(r => !r.error).map(r => r.data);
      if (createdNodes.length === 0) {
        throw new Error('Failed to create nodes');
      }

      // Map nodeId to actual database ID
      const nodeIdMap = new Map(nodesData.map((node: any, idx: number) => [node.nodeId, createdNodes[idx]?.id]));
      const newFlowNodes = createdNodes.map(node => ({
        id: node.id,
        type: 'custom',
        position: {
          x: node.position_x,
          y: node.position_y
        },
        data: {
          label: node.label,
          content: node.content,
          color: node.color,
          diagramType: diagramType,
          onOpenPanel: (n: Node) => {
            setSelectedNode(n);
            setIsPanelOpen(true);
            onNodePanelChange?.(n, true);
          },
          onSelectForAI: (n: Node) => {
            setSelectedNode(n);
            setIsPanelOpen(false);
            onNodePanelChange?.(n, false);
            setIsAiToolbarDismissed(false);
          }
        }
      }));
      setNodes(nds => [...nds, ...newFlowNodes]);

      // Create edges based ONLY on AI connections - trust the AI's layout decisions
      const edgesToCreate = [];

      // Create AI-specified connections between nodes with handles
      nodesData.forEach((nodeData: any) => {
        const sourceId = nodeIdMap.get(nodeData.nodeId);
        nodeData.connections?.forEach((conn: any) => {
          const targetId = nodeIdMap.get(conn.targetNodeId);
          if (sourceId && targetId && sourceId !== targetId) {
            edgesToCreate.push({
              mind_map_id: mindMapId,
              source_node_id: sourceId,
              target_node_id: targetId,
              source_handle: conn.sourceHandle,
              target_handle: conn.targetHandle,
              user_id: user.user.id
            });
          }
        });
      });
      if (edgesToCreate.length > 0) {
        await supabase.from('edges').insert(edgesToCreate);
        const newEdges = edgesToCreate.map((edge, idx) => ({
          id: `${edge.source_node_id}-${edge.target_node_id}-${idx}`,
          source: edge.source_node_id,
          target: edge.target_node_id,
          sourceHandle: edge.source_handle,
          targetHandle: edge.target_handle,
          type: diagramType === 'hierarchical' ? 'smoothstep' : 'default',
          animated: true,
          style: {
            stroke: 'hsl(var(--accent))',
            strokeWidth: 2.5,
            strokeDasharray: diagramType === 'network' ? '5,5' : undefined
          }
        }));
        setEdges(eds => [...eds, ...newEdges]);
      }
      setAiPrompt('');
      setSelectedNode(null);
      toast.success(`Generated ${createdNodes.length} nodes in ${diagramType} layout!`);
    } catch (error) {
      console.error('AI generation error:', error);
      toast.error('Failed to generate nodes');
    } finally {
      setIsGenerating(false);
    }
  };
  const updateNode = async (nodeId: string, updates: {
    label?: string;
    content?: string;
    links?: any[];
    images?: any[];
    documents?: any[];
  }) => {
    const {
      error
    } = await supabase.from('nodes').update(updates).eq('id', nodeId);
    if (error) {
      toast.error('Failed to update node');
      return;
    }
    setNodes(nds => nds.map(node => node.id === nodeId ? {
      ...node,
      data: {
        ...node.data,
        ...updates
      }
    } : node));
    if (selectedNode?.id === nodeId) {
      setSelectedNode({
        ...selectedNode,
        data: {
          ...selectedNode.data,
          ...updates
        }
      });
    }
  };
  const deleteNode = async (nodeId: string) => {
    await supabase.from('nodes').delete().eq('id', nodeId);
    setNodes(nds => nds.filter(node => node.id !== nodeId));
    setIsPanelOpen(false);
    setSelectedNode(null);
    onNodePanelChange?.(null, false);
    toast.success('Node deleted');
  };
  const clearAllNodes = async () => {
    setIsClearing(true);
    try {
      // Delete all edges first (due to foreign key constraints)
      const {
        error: edgesError
      } = await supabase.from('edges').delete().eq('mind_map_id', mindMapId);
      if (edgesError) throw edgesError;

      // Delete all nodes
      const {
        error: nodesError
      } = await supabase.from('nodes').delete().eq('mind_map_id', mindMapId);
      if (nodesError) throw nodesError;

      // Clear local state
      setNodes([]);
      setEdges([]);
      setSelectedNode(null);
      setIsPanelOpen(false);
      onNodePanelChange?.(null, false);
      toast.success('Canvas cleared');
    } catch (error) {
      console.error('Clear error:', error);
      toast.error('Failed to clear canvas');
    } finally {
      setIsClearing(false);
    }
  };
  return <div className="w-full h-screen relative">
      <ReactFlow 
        nodes={nodes} 
        edges={edges} 
        onNodesChange={onNodesChange} 
        onEdgesChange={onEdgesChange} 
        onConnect={onConnect} 
        onConnectEnd={onConnectEnd} 
        onNodeDragStop={onNodeDragStop} 
        onPaneClick={onPaneClick}
        nodeTypes={nodeTypes} 
        fitView
        className={isAddNodeMode ? 'cursor-crosshair' : ''}
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} />
        <Controls />
        <MiniMap 
          nodeColor={(node) => (node.data.color as string) || 'hsl(var(--primary))'} 
          maskColor="hsl(var(--card) / 0.9)"
          className="!bg-card !border-2 !border-primary/30 !rounded-lg !shadow-lg"
          style={{ 
            backgroundColor: 'hsl(var(--card))',
            border: '2px solid hsl(var(--primary) / 0.3)'
          }}
        />
      </ReactFlow>

      {/* Add Node Button - Bottom Left */}
      <div className="absolute bottom-6 left-6 z-10 flex flex-col gap-2">
        <Button 
          onClick={() => setIsAddNodeMode(!isAddNodeMode)} 
          className={`gap-2 shadow-lg transition-all ${isAddNodeMode ? 'bg-accent hover:bg-accent/90 ring-2 ring-accent-foreground' : ''}`}
          variant={isAddNodeMode ? 'default' : 'secondary'}
        >
          <Plus className="w-4 h-4" />
          {isAddNodeMode ? 'Click to Place' : 'Add Node (1)'}
        </Button>
        {isAddNodeMode && (
          <div className="text-xs text-muted-foreground bg-card/90 backdrop-blur px-3 py-2 rounded-lg border border-border animate-fade-in">
            Click anywhere to add a node (ESC to cancel)
          </div>
        )}
      </div>

      {/* Clear All Button - Always Visible */}
      <div className="absolute top-4 right-4 z-10">
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" className="gap-2 shadow-lg" disabled={isClearing}>
              <Trash2 className="w-4 h-4" />
              Clear All
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Clear entire canvas?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete all nodes and connections. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={clearAllNodes}>Clear All</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      {/* AI Toolbar - Right of Add Node Button */}
      {selectedNode && !isPanelOpen && !isAiToolbarDismissed && (
        <div 
          className="absolute bottom-6 left-56 z-10 flex flex-col gap-2 bg-card/95 backdrop-blur-lg p-4 rounded-xl border-2 border-primary/40 shadow-2xl animate-fade-in"
        >
          <div className="flex items-center justify-between gap-4">
            <div className="text-xs text-muted-foreground font-medium">Expand from: {String(selectedNode.data.label)}</div>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => setIsAiToolbarDismissed(true)}
              className="h-6 w-6 p-0 hover:bg-destructive/20"
            >
              <span className="text-lg leading-none">×</span>
            </Button>
          </div>
          <div className="flex gap-2">
            <Input 
              placeholder="Generate nodes with AI..." 
              value={aiPrompt} 
              onChange={e => setAiPrompt(e.target.value)} 
              onKeyPress={e => e.key === 'Enter' && !isGenerating && generateWithAI()} 
              className="w-80"
              disabled={isGenerating}
            />
            <Button onClick={generateWithAI} disabled={isGenerating} className="gap-2 min-w-[120px]">
              <Sparkles className="w-4 h-4" />
              {isGenerating ? 'Generating...' : 'Generate'}
            </Button>
          </div>
        </div>
      )}

      {/* Side Panel */}
      <NodePanel node={selectedNode} isOpen={isPanelOpen} onClose={() => {
        setIsPanelOpen(false);
        setSelectedNode(null);
        onNodePanelChange?.(null, false);
      }} onUpdate={updateNode} onDelete={deleteNode} />
    </div>;
};
export const MindMapCanvas = ({ 
  mindMapId,
  onNodePanelChange 
}: { 
  mindMapId: string;
  onNodePanelChange?: (node: Node | null, isOpen: boolean) => void;
}) => {
  return <ReactFlowProvider>
      <MindMapCanvasInner mindMapId={mindMapId} onNodePanelChange={onNodePanelChange} />
    </ReactFlowProvider>;
};