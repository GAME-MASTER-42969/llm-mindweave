-- Create mind_maps table
CREATE TABLE public.mind_maps (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL DEFAULT 'Untitled Mind Map',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create nodes table
CREATE TABLE public.nodes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  mind_map_id UUID NOT NULL REFERENCES public.mind_maps(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  label TEXT NOT NULL,
  content TEXT,
  position_x REAL NOT NULL DEFAULT 0,
  position_y REAL NOT NULL DEFAULT 0,
  type TEXT NOT NULL DEFAULT 'default',
  color TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create edges table
CREATE TABLE public.edges (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  mind_map_id UUID NOT NULL REFERENCES public.mind_maps(id) ON DELETE CASCADE,
  source_node_id UUID NOT NULL REFERENCES public.nodes(id) ON DELETE CASCADE,
  target_node_id UUID NOT NULL REFERENCES public.nodes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.mind_maps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.edges ENABLE ROW LEVEL SECURITY;

-- Policies for mind_maps
CREATE POLICY "Users can view their own mind maps"
ON public.mind_maps FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own mind maps"
ON public.mind_maps FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own mind maps"
ON public.mind_maps FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own mind maps"
ON public.mind_maps FOR DELETE
USING (auth.uid() = user_id);

-- Policies for nodes
CREATE POLICY "Users can view their own nodes"
ON public.nodes FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own nodes"
ON public.nodes FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own nodes"
ON public.nodes FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own nodes"
ON public.nodes FOR DELETE
USING (auth.uid() = user_id);

-- Policies for edges
CREATE POLICY "Users can view their own edges"
ON public.edges FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own edges"
ON public.edges FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own edges"
ON public.edges FOR DELETE
USING (auth.uid() = user_id);

-- Function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Triggers for automatic timestamp updates
CREATE TRIGGER update_mind_maps_updated_at
BEFORE UPDATE ON public.mind_maps
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_nodes_updated_at
BEFORE UPDATE ON public.nodes
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();