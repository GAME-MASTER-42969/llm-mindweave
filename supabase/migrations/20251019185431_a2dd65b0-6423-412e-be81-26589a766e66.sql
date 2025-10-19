-- Add source_handle and target_handle columns to edges table
ALTER TABLE public.edges
ADD COLUMN source_handle TEXT,
ADD COLUMN target_handle TEXT;