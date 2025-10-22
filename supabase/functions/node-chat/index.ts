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
    const { messages, nodeContext } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    const systemPrompt = nodeContext 
      ? `You are a helpful AI assistant for a mind mapping application. 
         The user is currently working on a node with the following details:
         - Label: ${nodeContext.label}
         - Content: ${nodeContext.content || 'No content yet'}
         - Links: ${nodeContext.links?.length || 0} link(s)
         - Images: ${nodeContext.images?.length || 0} image(s)
         - Documents: ${nodeContext.documents?.length || 0} document(s)
         
         You can help the user by modifying the node data using the available tools.`
      : 'You are a helpful AI assistant for a mind mapping application.';

    const tools = nodeContext ? [
      {
        type: 'function',
        function: {
          name: 'update_content',
          description: 'Update the content/notes of the current node',
          parameters: {
            type: 'object',
            properties: {
              content: { type: 'string', description: 'The new content for the node' }
            },
            required: ['content']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'add_link',
          description: 'Add a link to the current node',
          parameters: {
            type: 'object',
            properties: {
              url: { type: 'string', description: 'The URL to add' },
              title: { type: 'string', description: 'Optional title for the link' }
            },
            required: ['url']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'add_image_url',
          description: 'Add an image URL to the current node',
          parameters: {
            type: 'object',
            properties: {
              url: { type: 'string', description: 'The image URL to add' }
            },
            required: ['url']
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
