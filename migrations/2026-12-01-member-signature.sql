-- Signature image (PNG data URL) for a project member; used for the Project Manager
-- on the Budget Control report ("Prepared By").
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS signature text NOT NULL DEFAULT '';
