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
      ? `You are a helpful AI assistant for a mind mapping application with web research capabilities.
         
         Here are all the nodes in the current mind map:
         ${JSON.stringify(allNodes.map((n: any) => ({
           id: n.id,
           label: n.data?.label || n.label,
           content: n.data?.content || n.content,
           links: n.data?.links || n.links || [],
           images: n.data?.images || n.images || [],
           documents: n.data?.documents || n.documents || []
         })), null, 2)}
         
         Node ID map (use these exact IDs in tool calls):
         ${allNodes.map((n: any) => `- ${n.id} => "${n.data?.label || n.label || ''}"`).join('\n')}
         
         You can help the user by:
         1. Researching topics and providing detailed, accurate information
         2. Analyzing the mind map nodes and suggesting updates
         3. Updating any node's data using the available tools
         
         When conducting research:
         - Provide comprehensive, well-researched answers
         - Include relevant facts, statistics, and insights
         - Cite key information when applicable
         
         CRITICAL editing rules:
         - Never create new nodes. Only modify existing nodes using their nodeId from the map above.
         - If the user refers to a node by name, resolve it to the correct nodeId from the map.
         - Select the correct section tool: use update_node_content for Notes; add_node_link for Links; add_node_image for Media; update_node_label for Title.
         - If they say "all nodes" or reference multiple nodes, issue one tool call per node (bulk).
         - For bulk requests like "add info to all nodes in the notes and links": for each node, call update_node_content with concise, relevant additions AND call add_node_link with 1-2 credible URLs when asked to add links.
         - For bulk changes, return tool calls only (no explanatory prose).`
      : 'You are a helpful AI assistant for a mind mapping application with web research capabilities.';

    const tools = allNodes && allNodes.length > 0 ? [
      {
        type: 'function',
        function: {
          name: 'update_node_content',
          description: 'Update the content/notes of any existing node by ID (append to existing notes, do not replace unless explicitly asked).',
          parameters: {
            type: 'object',
            properties: {
              nodeId: { 
                type: 'string', 
                description: 'The ID of the node to update. Choose from the Node ID map above.',
                enum: allNodes.map((n: any) => n.id)
              },
              content: { type: 'string', description: 'The content to add to the node\'s notes.' }
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
              nodeId: { 
                type: 'string', 
                description: 'The ID of the node to update. Choose from the Node ID map above.',
                enum: allNodes.map((n: any) => n.id)
              },
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
          description: 'Add a link to any node by ID (links section).',
          parameters: {
            type: 'object',
            properties: {
              nodeId: { 
                type: 'string', 
                description: 'The ID of the node to add the link to. Choose from the Node ID map above.',
                enum: allNodes.map((n: any) => n.id)
              },
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
          description: 'Add an image URL to any node by ID (media section).',
          parameters: {
            type: 'object',
            properties: {
              nodeId: { 
                type: 'string', 
                description: 'The ID of the node to add the image to. Choose from the Node ID map above.',
                enum: allNodes.map((n: any) => n.id)
              },
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
      max_completion_tokens: 1200,
      tool_choice: 'auto',
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
        return new Response(JSON.stringify({ error: 'Payment required, please add credits to your Lovable AI workspace.' }), {
          status: 402,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (response.status === 401) {
        return new Response(JSON.stringify({ error: 'Unauthorized AI gateway key.' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const errorText = await response.text();
      console.error('AI gateway error:', response.status, errorText);
      return new Response(JSON.stringify({ error: 'AI gateway error', details: errorText }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const data = await response.json();
    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Chat error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
