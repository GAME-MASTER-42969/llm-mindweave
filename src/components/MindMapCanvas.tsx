import { useCallback, useEffect, useState } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  Connection,
  Node,
  Edge,
  BackgroundVariant,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { supabase } from '@/integrations/supabase/client';
import { MindMapNode } from './MindMapNode';
import { NodePanel } from './NodePanel';
import { Button } from './ui/button';
import { Plus, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { Input } from './ui/input';

const nodeTypes = {
  custom: MindMapNode,
};

export const MindMapCanvas = ({ mindMapId }: { mindMapId: string }) => {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  // Load nodes and edges
  useEffect(() => {
    loadMindMap();
  }, [mindMapId]);

  const loadMindMap = async () => {
    const { data: nodesData } = await supabase
      .from('nodes')
      .select('*')
      .eq('mind_map_id', mindMapId);

    const { data: edgesData } = await supabase
      .from('edges')
      .select('*')
      .eq('mind_map_id', mindMapId);

    if (nodesData) {
      const flowNodes = nodesData.map(node => ({
        id: node.id,
        type: 'custom',
        position: { x: node.position_x, y: node.position_y },
        data: { 
          label: node.label, 
          content: node.content,
          color: node.color,
          onOpenPanel: (node: Node) => {
            setSelectedNode(node);
            setIsPanelOpen(true);
          }
        },
      }));
      setNodes(flowNodes);
    }

    if (edgesData) {
      const flowEdges = edgesData.map(edge => ({
        id: edge.id,
        source: edge.source_node_id,
        target: edge.target_node_id,
        type: 'smoothstep',
        animated: true,
        style: { stroke: 'hsl(var(--accent))', strokeWidth: 2 },
      }));
      setEdges(flowEdges);
    }
  };

  const onConnect = useCallback(
    async (connection: Connection) => {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) return;

      const newEdge: Edge = {
        id: `${connection.source}-${connection.target}`,
        source: connection.source!,
        target: connection.target!,
        type: 'smoothstep',
        animated: true,
        style: { stroke: 'hsl(var(--accent))', strokeWidth: 2 },
      };

      const { error } = await supabase.from('edges').insert({
        mind_map_id: mindMapId,
        source_node_id: connection.source,
        target_node_id: connection.target,
        user_id: user.user.id,
      });

      if (error) {
        toast.error('Failed to create connection');
        return;
      }

      setEdges((eds) => addEdge(newEdge, eds));
      toast.success('Connection created');
    },
    [mindMapId, setEdges]
  );

  const onNodeDragStop = async (_: any, node: Node) => {
    await supabase
      .from('nodes')
      .update({
        position_x: node.position.x,
        position_y: node.position.y,
      })
      .eq('id', node.id);
  };

  const addNewNode = async () => {
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) return;

    const newNode = {
      mind_map_id: mindMapId,
      user_id: user.user.id,
      label: 'New Node',
      content: 'Add your notes here...',
      position_x: Math.random() * 500,
      position_y: Math.random() * 500,
    };

    const { data, error } = await supabase
      .from('nodes')
      .insert(newNode)
      .select()
      .single();

    if (error) {
      toast.error('Failed to create node');
      return;
    }

    const flowNode = {
      id: data.id,
      type: 'custom',
      position: { x: data.position_x, y: data.position_y },
      data: { 
        label: data.label, 
        content: data.content,
        onOpenPanel: (node: Node) => {
          setSelectedNode(node);
          setIsPanelOpen(true);
        }
      },
    };

    setNodes((nds) => [...nds, flowNode]);
    toast.success('Node created');
  };

  const generateWithAI = async () => {
    if (!aiPrompt.trim()) {
      toast.error('Please enter a prompt');
      return;
    }

    setIsGenerating(true);
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) return;

      const { data, error } = await supabase.functions.invoke('generate-node', {
        body: { prompt: aiPrompt, context: selectedNode?.data.label },
      });

      if (error) throw error;

      const nodesData = data.nodes || [];
      const baseX = selectedNode ? selectedNode.position.x + 250 : 300;
      const baseY = selectedNode ? selectedNode.position.y : 300;
      const angleStep = (2 * Math.PI) / nodesData.length;
      const radius = 200;

      // Create nodes
      const insertPromises = nodesData.map((nodeData: any, index: number) => {
        const angle = index * angleStep;
        const x = baseX + radius * Math.cos(angle);
        const y = baseY + radius * Math.sin(angle);

        return supabase
          .from('nodes')
          .insert({
            mind_map_id: mindMapId,
            user_id: user.user.id,
            label: nodeData.label,
            content: nodeData.content,
            position_x: x,
            position_y: y,
          })
          .select()
          .single();
      });

      const results = await Promise.all(insertPromises);
      const createdNodes = results.filter(r => !r.error).map(r => r.data);

      if (createdNodes.length === 0) {
        throw new Error('Failed to create nodes');
      }

      // Map nodeId to actual database ID
      const nodeIdMap = new Map(
        nodesData.map((node: any, idx: number) => [node.nodeId, createdNodes[idx]?.id])
      );

      const newFlowNodes = createdNodes.map((node) => ({
        id: node.id,
        type: 'custom',
        position: { x: node.position_x, y: node.position_y },
        data: {
          label: node.label,
          content: node.content,
          onOpenPanel: (n: Node) => {
            setSelectedNode(n);
            setIsPanelOpen(true);
          }
        },
      }));

      setNodes((nds) => [...nds, ...newFlowNodes]);

      // Create edges based on AI connections + parent node
      const edgesToCreate = [];
      
      // Connect selected node to all new nodes if there's a parent
      if (selectedNode) {
        createdNodes.forEach((node) => {
          edgesToCreate.push({
            mind_map_id: mindMapId,
            source_node_id: selectedNode.id,
            target_node_id: node.id,
            user_id: user.user.id,
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
              user_id: user.user.id,
            });
          }
        });
      });

      if (edgesToCreate.length > 0) {
        await supabase.from('edges').insert(edgesToCreate);

        const newEdges = edgesToCreate.map((edge) => ({
          id: `${edge.source_node_id}-${edge.target_node_id}`,
          source: edge.source_node_id,
          target: edge.target_node_id,
          type: 'smoothstep',
          animated: true,
          style: { stroke: 'hsl(var(--accent))', strokeWidth: 2 },
        }));

        setEdges((eds) => [...eds, ...newEdges]);
      }

      setAiPrompt('');
      toast.success(`Generated ${createdNodes.length} connected nodes!`);
    } catch (error) {
      console.error('AI generation error:', error);
      toast.error('Failed to generate nodes');
    } finally {
      setIsGenerating(false);
    }
  };

  const updateNode = async (nodeId: string, updates: { label?: string; content?: string }) => {
    const { error } = await supabase
      .from('nodes')
      .update(updates)
      .eq('id', nodeId);

    if (error) {
      toast.error('Failed to update node');
      return;
    }

    setNodes((nds) =>
      nds.map((node) =>
        node.id === nodeId
          ? { ...node, data: { ...node.data, ...updates } }
          : node
      )
    );
    
    if (selectedNode?.id === nodeId) {
      setSelectedNode({ ...selectedNode, data: { ...selectedNode.data, ...updates } });
    }
  };

  const deleteNode = async (nodeId: string) => {
    await supabase.from('nodes').delete().eq('id', nodeId);
    setNodes((nds) => nds.filter((node) => node.id !== nodeId));
    setIsPanelOpen(false);
    setSelectedNode(null);
    toast.success('Node deleted');
  };

  return (
    <div className="w-full h-screen relative">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeDragStop={onNodeDragStop}
        nodeTypes={nodeTypes}
        fitView
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} />
        <Controls />
        <MiniMap
          nodeColor={() => 'hsl(var(--primary))'}
          maskColor="hsl(var(--background) / 0.8)"
        />
      </ReactFlow>

      {/* Floating Toolbar */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 flex gap-2 bg-card/90 backdrop-blur-md p-4 rounded-xl border border-border shadow-lg animate-fade-in">
        <Input
          placeholder="Generate node with AI..."
          value={aiPrompt}
          onChange={(e) => setAiPrompt(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && generateWithAI()}
          className="w-64"
        />
        <Button onClick={generateWithAI} disabled={isGenerating} className="gap-2">
          <Sparkles className="w-4 h-4" />
          {isGenerating ? 'Generating...' : 'Generate'}
        </Button>
        <Button onClick={addNewNode} variant="secondary" className="gap-2">
          <Plus className="w-4 h-4" />
          Add Node
        </Button>
      </div>

      {/* Side Panel */}
      <NodePanel
        node={selectedNode}
        isOpen={isPanelOpen}
        onClose={() => {
          setIsPanelOpen(false);
          setSelectedNode(null);
        }}
        onUpdate={updateNode}
        onDelete={deleteNode}
      />
    </div>
  );
};
