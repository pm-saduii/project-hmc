-- Form data for generated company documents (kept with the record they belong to):
--   change_requests.form       → Change Request Form v1.4 (.docx)
--   project_deliverables.form  → Project Deliverable Sign-off v1.3 (.docx)
-- Existing row-level security on both tables applies. Safe to run more than once.
ALTER TABLE public.change_requests ADD COLUMN IF NOT EXISTS form jsonb;
ALTER TABLE public.project_deliverables ADD COLUMN IF NOT EXISTS form jsonb;
