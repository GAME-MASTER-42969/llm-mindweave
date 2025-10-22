-- Add new columns to nodes table for links, images, and documents
ALTER TABLE public.nodes
ADD COLUMN IF NOT EXISTS links jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS images jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS documents jsonb DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.nodes.links IS 'Array of reference links: [{title: string, url: string, id: string}]';
COMMENT ON COLUMN public.nodes.images IS 'Array of images: [{id: string, url: string, type: "upload"|"generated"|"link", name: string}]';
COMMENT ON COLUMN public.nodes.documents IS 'Array of documents: [{id: string, name: string, type: string, url: string, size: number}]';