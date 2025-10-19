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
    
    Each node should have:
    - A unique nodeId (0, 1, 2, etc.)
    - A concise label (max 40 characters)
    - Detailed content explaining that aspect (2-3 sentences)
    - connectsTo: array of nodeIds this node should connect to (create logical relationships)
    
    Create a logical hierarchy with meaningful connections between related concepts.`;

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
              description: "Create multiple interconnected mind map nodes with relationships",
              parameters: {
                type: "object",
                properties: {
                  nodes: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        nodeId: { type: "number" },
                        label: { type: "string" },
                        content: { type: "string" },
                        connectsTo: { 
                          type: "array",
                          items: { type: "number" }
                        }
                      },
                      required: ["nodeId", "label", "content", "connectsTo"],
                      additionalProperties: false
                    },
                    minItems: 3,
                    maxItems: 5
                  }
                },
                required: ["nodes"],
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
      } catch {
        result = {
          nodes: [{
            label: prompt.substring(0, 40),
            content: "Failed to parse AI response. Please try again."
          }]
        };
      }
    } else {
      result = {
        nodes: [{
          label: prompt.substring(0, 40),
          content: data.choices[0].message.content || "No content generated."
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
