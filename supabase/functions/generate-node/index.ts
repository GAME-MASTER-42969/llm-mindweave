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
    const { prompt, context } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    console.log('Generating node with prompt:', prompt);

    const systemPrompt = `You are an AI assistant creating professional mind map layouts. 
    When given a prompt, break it down into relevant subtopics with optimal visual organization.
    ${context ? `Parent context: "${context}" - Expand on this with related nodes positioned logically around it.` : 'Create a comprehensive mind map covering the topic.'}
    
    DIAGRAM TYPE SELECTION:
    - "hierarchical": Top-down tree (organizational charts, taxonomies, processes with clear parent-child relationships)
    - "radial": Hub-and-spoke from center (brainstorming, exploring one central concept with categories)
    - "linear": Left-to-right flow (timelines, sequential steps, cause-and-effect chains)
    - "network": Interconnected web (complex relationships, systems thinking, multiple interdependencies)
    - "matrix": Grid layout (comparisons, 2D classifications, feature matrices)
    
    POSITIONING STRATEGY:
    - Hierarchical: Place parent at top (y: -400), children below (y: -150, 100, 350) with x spacing of 400px
    - Radial: Center node at (0, 0), surrounding nodes at radius 450-500px in circular pattern
    - Linear: Space nodes left-to-right with 450px horizontal gaps, y: 0 for main flow
    - Network: Distribute evenly with minimum 350px between any two nodes, consider visual balance
    - Matrix: Use grid cells 400px × 350px, align nodes to grid intersections
    
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
    1. Maintain generous spacing (minimum 350px between nodes)
    2. Create visual hierarchy through positioning
    3. Group related concepts spatially
    4. Minimize edge crossings by smart handle selection
    5. Balance the overall composition
    6. Use handle directions that match the diagram flow`;

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
                        x: { type: "number", description: "X position (-600 to 600), maintain 350px minimum spacing" },
                        y: { type: "number", description: "Y position (-600 to 600), position according to diagram type" },
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
