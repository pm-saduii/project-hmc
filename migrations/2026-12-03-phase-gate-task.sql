-- Link each methodology phase of a project to its main task in the plan.
-- The gate shows "Ready to pass" when the phase's deliverables are complete and every task under it is done.
ALTER TABLE public.project_phase_gates
  ADD COLUMN IF NOT EXISTS task_id uuid REFERENCES public.tasks(id) ON DELETE SET NULL;
