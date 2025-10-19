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

    const systemPrompt = `You are an AI assistant helping to create mind map nodes. 
    When given a prompt, break it down into 3-5 key subtopics or aspects.
    ${context ? `Parent context: "${context}" - Create nodes that expand on this topic.` : 'Create nodes that comprehensively cover the topic.'}
    
    First, determine the best diagram type for this topic:
    - "hierarchical": Top-down tree structure (best for organizational charts, classification)
    - "radial": Central concept with branches radiating outward (best for exploring a central idea)
    - "linear": Sequential flow left-to-right (best for processes, timelines, steps)
    - "network": Interconnected web (best for showing complex relationships)
    - "matrix": Grid layout (best for comparing multiple dimensions)
    
    Then create nodes with:
    - A unique nodeId (0, 1, 2, etc.)
    - A concise label (max 40 characters)
    - Detailed content explaining that aspect (2-3 sentences)
    - connectsTo: array of nodeIds this node should connect to (create logical relationships)
    - x, y: position coordinates that match the chosen diagram type (values between -400 and 400)
    
    Position nodes to create a clear visual structure that matches the diagram type.
    For hierarchical: place parent nodes higher (negative y), children lower
    For radial: arrange nodes in a circle around center
    For linear: arrange nodes left to right with consistent spacing
    For network: spread nodes to minimize edge crossings
    For matrix: use grid-aligned positions`;

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
                        label: { type: "string" },
                        content: { type: "string" },
                        x: { type: "number", description: "X position matching diagram type (-400 to 400)" },
                        y: { type: "number", description: "Y position matching diagram type (-400 to 400)" },
                        connectsTo: { 
                          type: "array",
                          items: { type: "number" }
                        }
                      },
                      required: ["nodeId", "label", "content", "x", "y", "connectsTo"],
                      additionalProperties: false
                    },
                    minItems: 3,
                    maxItems: 5
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
            connectsTo: []
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
          connectsTo: []
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
