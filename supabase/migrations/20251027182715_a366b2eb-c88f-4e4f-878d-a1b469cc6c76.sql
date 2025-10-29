-- Add pdf_url column to reports table
ALTER TABLE public.reports 
ADD COLUMN IF NOT EXISTS pdf_url TEXT;