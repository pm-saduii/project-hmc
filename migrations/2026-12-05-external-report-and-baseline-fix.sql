-- 1) External (customer) version of the monthly report: its own summary and the actions needed from the customer.
ALTER TABLE public.monthly_reports ADD COLUMN IF NOT EXISTS external_summary text NOT NULL DEFAULT '';
ALTER TABLE public.monthly_reports ADD COLUMN IF NOT EXISTS client_actions  text NOT NULL DEFAULT '';

-- 2) Baselines copied from another project.
-- Before 25/11/2026, "copy tasks from another project" also copied the baseline dates, so a project copied
-- from an earlier one (e.g. Phase 2 from Phase 1) shows the earlier project's baseline in the Gantt and the
-- One Page timeline. Clear the baseline of every project where most baselined tasks carry exactly the
-- baseline of a same-named, older task in another project. The PM then saves the baseline again (Tasks › Save Baseline).
WITH based AS (
  SELECT t.id, t.project_id, t.task_name, t.baseline_start_date, t.baseline_end_date, t.created_at
  FROM public.tasks t
  WHERE t.baseline_start_date IS NOT NULL OR t.baseline_end_date IS NOT NULL
),
per_project AS (
  SELECT b.project_id,
         count(*) AS baselined,
         count(*) FILTER (WHERE EXISTS (
           SELECT 1 FROM public.tasks s
           WHERE s.project_id <> b.project_id
             AND s.task_name = b.task_name
             AND s.baseline_start_date IS NOT DISTINCT FROM b.baseline_start_date
             AND s.baseline_end_date   IS NOT DISTINCT FROM b.baseline_end_date
             AND s.created_at < b.created_at
         )) AS copied
  FROM based b
  GROUP BY b.project_id
)
UPDATE public.tasks t
SET baseline_start_date = NULL, baseline_end_date = NULL
FROM per_project p
WHERE t.project_id = p.project_id
  AND p.copied * 2 >= p.baselined
  AND p.copied > 0;
