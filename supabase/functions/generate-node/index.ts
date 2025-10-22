import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { prompt, context, baseX = 0, baseY = 0 } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    console.log('Generating node with prompt:', prompt, 'Base position:', baseX, baseY);

    const systemPrompt = `You are an AI assistant creating professional mind map layouts. 
    When given a prompt, break it down into relevant subtopics with optimal visual organization.
    ${context ? `Parent context: "${context}" - Expand on this with related nodes positioned logically around it.` : 'Create a comprehensive mind map covering the topic.'}
    
    DIAGRAM TYPE SELECTION:
    - "hierarchical": Top-down tree (organizational charts, taxonomies, processes with clear parent-child relationships)
    - "radial": Hub-and-spoke from center (brainstorming, exploring one central concept with categories)
    - "linear": Left-to-right flow (timelines, sequential steps, cause-and-effect chains)
    - "network": Interconnected web (complex relationships, systems thinking, multiple interdependencies)
    - "matrix": Grid layout (comparisons, 2D classifications, feature matrices)
    
    POSITIONING STRATEGY (RELATIVE TO BASE POINT ${baseX}, ${baseY}):
    - All coordinates should be absolute positions calculated from this base point
    - Hierarchical: Place parent near base, children spread below with 500px spacing
    - Radial: Place center node at base point (${baseX}, ${baseY}), surrounding nodes at radius 600-700px
    - Linear: Space nodes horizontally with 550px gaps, use baseY for alignment
    - Network: Distribute around base point with minimum 450px between any two nodes
    - Matrix: Create grid centered around base point with 500px × 450px cells
    
    CONNECTION HANDLES (critical for clean edges):
    Each node has 4 connection points: "top", "right", "bottom", "left"
    - Hierarchical: parent uses "bottom", children use "top"
    - Radial: center uses all sides based on direction to target, outer nodes point toward center
    - Linear: use "right" to "left" for forward flow
    - Network: choose handle that creates shortest, least overlapping path
    - Matrix: use handles that create horizontal/vertical lines when possible
    
    For each connection specify:
    - sourceHandle: which point on the source node ("top", "right", "bottom", "left")
    - targetHandle: which point on the target node ("top", "right", "bottom", "left")
    
    LAYOUT PRINCIPLES:
    1. Calculate absolute x,y positions - do not use offsets, the positions you provide are final
    2. Maintain generous spacing (minimum 450px between nodes)
    3. Create visual hierarchy through positioning
    4. Group related concepts spatially
    5. Minimize edge crossings by smart handle selection
    6. Position new diagram to not overlap with existing content at origin (0,0)
    7. Use the base point (${baseX}, ${baseY}) as the focal/reference point for this entire diagram`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt }
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "create_mind_map_nodes",
              description: "Create multiple interconnected mind map nodes with optimal layout",
              parameters: {
                type: "object",
                properties: {
                  diagramType: {
                    type: "string",
                    enum: ["hierarchical", "radial", "linear", "network", "matrix"],
                    description: "The type of diagram layout that best represents this topic"
                  },
                  nodes: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        nodeId: { type: "number" },
                        label: { type: "string", description: "Concise label, max 40 characters" },
                        content: { type: "string", description: "Detailed explanation, 2-3 sentences" },
                        x: { type: "number", description: "Absolute X position on canvas, maintain 450px minimum spacing between nodes" },
                        y: { type: "number", description: "Absolute Y position on canvas, position according to diagram type" },
                        connections: { 
                          type: "array",
                          items: {
                            type: "object",
                            properties: {
                              targetNodeId: { type: "number", description: "Node ID to connect to" },
                              sourceHandle: { type: "string", enum: ["top", "right", "bottom", "left"], description: "Connection point on this node" },
                              targetHandle: { type: "string", enum: ["top", "right", "bottom", "left"], description: "Connection point on target node" }
                            },
                            required: ["targetNodeId", "sourceHandle", "targetHandle"]
                          },
                          description: "Connections with specific handle positions for clean edge routing"
                        }
                      },
                      required: ["nodeId", "label", "content", "x", "y", "connections"],
                      additionalProperties: false
                    },
                    minItems: 3
                  }
                },
                required: ["diagramType", "nodes"],
                additionalProperties: false
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "create_mind_map_nodes" } }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI API error:', response.status, errorText);
      throw new Error(`AI API error: ${response.status}`);
    }

    const data = await response.json();
    const toolCall = data.choices[0].message.tool_calls?.[0];
    
    let result;
    if (toolCall?.function?.arguments) {
      try {
        result = JSON.parse(toolCall.function.arguments);
        console.log('Diagram type:', result.diagramType);
      } catch {
        result = {
          diagramType: 'network',
          nodes: [{
            nodeId: 0,
            label: prompt.substring(0, 40),
            content: "Failed to parse AI response. Please try again.",
            x: 0,
            y: 0,
            connections: []
          }]
        };
      }
    } else {
      result = {
        diagramType: 'network',
        nodes: [{
          nodeId: 0,
          label: prompt.substring(0, 40),
          content: data.choices[0].message.content || "No content generated.",
          x: 0,
          y: 0,
          connections: []
        }]
      };
    }

    console.log('Generated nodes:', result);
    
    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in generate-node function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
