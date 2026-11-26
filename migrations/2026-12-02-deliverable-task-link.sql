-- Link a project deliverable to a task in the project plan. The task's end date becomes the
-- deliverable's due date and its % / status show on the Methodology board.
-- Deleting the task only removes the link.
ALTER TABLE public.project_deliverables
  ADD COLUMN IF NOT EXISTS task_id uuid REFERENCES public.tasks(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS project_deliverables_task_idx ON public.project_deliverables (task_id);
