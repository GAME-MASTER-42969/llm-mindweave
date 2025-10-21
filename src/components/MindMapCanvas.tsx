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
const MindMapCanvasInner = ({
  mindMapId
}: {
  mindMapId: string;
}) => {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const {
    screenToFlowPosition
  } = useReactFlow();

  // Load nodes and edges
  useEffect(() => {
    loadMindMap();
  }, [mindMapId]);
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
  const addNewNode = async () => {
    const {
      data: user
    } = await supabase.auth.getUser();
    if (!user.user) return;
    const newNode = {
      mind_map_id: mindMapId,
      user_id: user.user.id,
      label: 'New Node',
      content: 'Add your notes here...',
      position_x: Math.random() * 500,
      position_y: Math.random() * 500
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
        }
      }
    };
    setNodes(nds => [...nds, flowNode]);
    toast.success('Node created');
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
          context: selectedNode?.data.label
        }
      });
      if (error) throw error;
      const diagramType = data.diagramType || 'network';
      const nodesData = data.nodes || [];
      console.log(`Creating ${diagramType} diagram with ${nodesData.length} nodes`);
      const baseX = selectedNode ? selectedNode.position.x : 400;
      const baseY = selectedNode ? selectedNode.position.y : 300;

      // Create nodes using AI-specified positions
      const insertPromises = nodesData.map((nodeData: any) => {
        return supabase.from('nodes').insert({
          mind_map_id: mindMapId,
          user_id: user.user.id,
          label: nodeData.label,
          content: nodeData.content,
          position_x: baseX + (nodeData.x || 0),
          position_y: baseY + (nodeData.y || 0)
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
          onOpenPanel: (n: Node) => {
            setSelectedNode(n);
            setIsPanelOpen(true);
          }
        }
      }));
      setNodes(nds => [...nds, ...newFlowNodes]);

      // Create edges based on AI connections + parent node
      const edgesToCreate = [];

      // Connect selected node to all new nodes if there's a parent
      if (selectedNode) {
        createdNodes.forEach(node => {
          edgesToCreate.push({
            mind_map_id: mindMapId,
            source_node_id: selectedNode.id,
            target_node_id: node.id,
            user_id: user.user.id
          });
        });
      }

      // Create AI-specified connections between nodes
      nodesData.forEach((nodeData: any) => {
        const sourceId = nodeIdMap.get(nodeData.nodeId);
        nodeData.connectsTo?.forEach((targetNodeId: number) => {
          const targetId = nodeIdMap.get(targetNodeId);
          if (sourceId && targetId && sourceId !== targetId) {
            edgesToCreate.push({
              mind_map_id: mindMapId,
              source_node_id: sourceId,
              target_node_id: targetId,
              user_id: user.user.id
            });
          }
        });
      });
      if (edgesToCreate.length > 0) {
        await supabase.from('edges').insert(edgesToCreate);
        const newEdges = edgesToCreate.map(edge => ({
          id: `${edge.source_node_id}-${edge.target_node_id}`,
          source: edge.source_node_id,
          target: edge.target_node_id,
          type: 'smoothstep',
          animated: true,
          style: {
            stroke: 'hsl(var(--accent))',
            strokeWidth: 2
          }
        }));
        setEdges(eds => [...eds, ...newEdges]);
      }
      setAiPrompt('');
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
      toast.success('Canvas cleared');
    } catch (error) {
      console.error('Clear error:', error);
      toast.error('Failed to clear canvas');
    } finally {
      setIsClearing(false);
    }
  };
  return <div className="w-full h-screen relative">
      <ReactFlow nodes={nodes} edges={edges} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onConnect={onConnect} onConnectEnd={onConnectEnd} onNodeDragStop={onNodeDragStop} nodeTypes={nodeTypes} fitView>
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} />
        
        <MiniMap nodeColor={() => 'hsl(var(--primary))'} maskColor="hsl(var(--background) / 0.8)" />
      </ReactFlow>

      {/* Add Node Button - Always Visible */}
      <div className="absolute top-4 left-4 z-10">
        <Button onClick={addNewNode} className="gap-2 shadow-lg">
          <Plus className="w-4 h-4" />
          Add Node
        </Button>
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

      {/* AI Toolbar - Only when node selected */}
      {selectedNode && (
        <div 
          className="absolute z-10 flex gap-2 bg-card backdrop-blur-md p-4 rounded-xl border-2 border-primary/30 shadow-xl animate-fade-in"
          style={{
            left: `${selectedNode.position.x}px`,
            top: `${selectedNode.position.y + 150}px`,
          }}
        >
          <Input placeholder="Generate nodes with AI..." value={aiPrompt} onChange={e => setAiPrompt(e.target.value)} onKeyPress={e => e.key === 'Enter' && generateWithAI()} className="w-64" />
          <Button onClick={generateWithAI} disabled={isGenerating} className="gap-2">
            <Sparkles className="w-4 h-4" />
            {isGenerating ? 'Generating...' : 'Generate'}
          </Button>
        </div>
      )}

      {/* Side Panel */}
      <NodePanel node={selectedNode} isOpen={isPanelOpen} onClose={() => {
      setIsPanelOpen(false);
      setSelectedNode(null);
    }} onUpdate={updateNode} onDelete={deleteNode} />
    </div>;
};
export const MindMapCanvas = ({
  mindMapId
}: {
  mindMapId: string;
}) => {
  return <ReactFlowProvider>
      <MindMapCanvasInner mindMapId={mindMapId} />
    </ReactFlowProvider>;
};