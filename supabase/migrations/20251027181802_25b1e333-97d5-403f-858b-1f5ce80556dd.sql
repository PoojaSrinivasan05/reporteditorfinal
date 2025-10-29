-- Add pdf_storage_path to store the file path in storage
ALTER TABLE public.reports 
ADD COLUMN IF NOT EXISTS pdf_storage_path TEXT;

-- Create table to store PDF edits/annotations
CREATE TABLE IF NOT EXISTS public.pdf_edits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES public.reports(id) ON DELETE CASCADE,
  page_number INTEGER NOT NULL,
  edit_type TEXT NOT NULL, -- 'text', 'highlight', 'drawing', 'image'
  content TEXT,
  position_x NUMERIC NOT NULL,
  position_y NUMERIC NOT NULL,
  width NUMERIC,
  height NUMERIC,
  font_size INTEGER DEFAULT 16,
  font_family TEXT DEFAULT 'Arial',
  color TEXT DEFAULT '#000000',
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on pdf_edits
ALTER TABLE public.pdf_edits ENABLE ROW LEVEL SECURITY;

-- Allow anyone to view edits
CREATE POLICY "Anyone can view PDF edits"
ON public.pdf_edits FOR SELECT
USING (true);

-- Allow anyone to create edits
CREATE POLICY "Anyone can create PDF edits"
ON public.pdf_edits FOR INSERT
WITH CHECK (true);

-- Allow anyone to update edits
CREATE POLICY "Anyone can update PDF edits"
ON public.pdf_edits FOR UPDATE
USING (true);

-- Allow anyone to delete edits
CREATE POLICY "Anyone can delete PDF edits"
ON public.pdf_edits FOR DELETE
USING (true);

-- Add trigger for updated_at
CREATE TRIGGER update_pdf_edits_updated_at
BEFORE UPDATE ON public.pdf_edits
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create storage bucket for PDFs if not exists
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('pdfs', 'pdfs', true, 52428800, ARRAY['application/pdf'])
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 52428800,
  allowed_mime_types = ARRAY['application/pdf'];