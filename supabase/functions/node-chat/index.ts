import "https://deno.land/x/xhr@0.1.0/mod.ts";
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
    const { messages, allNodes } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    const systemPrompt = allNodes && allNodes.length > 0
      ? `You are a helpful AI assistant for a mind mapping application. 
         
         Here are all the nodes in the current mind map:
         ${JSON.stringify(allNodes.map((n: any) => ({
           id: n.id,
           label: n.data?.label || n.label,
           content: n.data?.content || n.content,
           links: n.data?.links || n.links || [],
           images: n.data?.images || n.images || [],
           documents: n.data?.documents || n.documents || []
         })), null, 2)}
         
         You can help the user by analyzing these nodes and updating any node's data using the available tools.
         When the user asks you to edit or update information, identify which node(s) need to be updated and use the appropriate tools.`
      : 'You are a helpful AI assistant for a mind mapping application.';

    const tools = allNodes && allNodes.length > 0 ? [
      {
        type: 'function',
        function: {
          name: 'update_node_content',
          description: 'Update the content/notes of any node by ID',
          parameters: {
            type: 'object',
            properties: {
              nodeId: { type: 'string', description: 'The ID of the node to update' },
              content: { type: 'string', description: 'The new content for the node' }
            },
            required: ['nodeId', 'content']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'update_node_label',
          description: 'Update the label/title of any node by ID',
          parameters: {
            type: 'object',
            properties: {
              nodeId: { type: 'string', description: 'The ID of the node to update' },
              label: { type: 'string', description: 'The new label for the node' }
            },
            required: ['nodeId', 'label']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'add_node_link',
          description: 'Add a link to any node by ID',
          parameters: {
            type: 'object',
            properties: {
              nodeId: { type: 'string', description: 'The ID of the node to add the link to' },
              url: { type: 'string', description: 'The URL to add' },
              title: { type: 'string', description: 'Optional title for the link' }
            },
            required: ['nodeId', 'url']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'add_node_image',
          description: 'Add an image URL to any node by ID',
          parameters: {
            type: 'object',
            properties: {
              nodeId: { type: 'string', description: 'The ID of the node to add the image to' },
              url: { type: 'string', description: 'The image URL to add' }
            },
            required: ['nodeId', 'url']
          }
        }
      }
    ] : undefined;

    const requestBody: any = {
      model: 'google/gemini-2.5-flash',
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages,
      ],
      stream: true,
    };

    if (tools) {
      requestBody.tools = tools;
    }

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: 'Rate limits exceeded, please try again later.' }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: 'Payment required, please add funds to your Lovable AI workspace.' }), {
          status: 402,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const errorText = await response.text();
      console.error('AI gateway error:', response.status, errorText);
      return new Response(JSON.stringify({ error: 'AI gateway error' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, 'Content-Type': 'text/event-stream' },
    });
  } catch (error) {
    console.error('Chat error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
