-- Add support for image edits in pdf_edits table
ALTER TABLE public.pdf_edits ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE public.pdf_edits ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE;