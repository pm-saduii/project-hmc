-- One Page (internal) and External Status (customer) share one status scale and the External report
-- gets a written Project Summary and frozen numbers once it is sent. Safe to run more than once.

-- External Status: project summary (written by the PM) and the numbers as they were when sent
ALTER TABLE public.status_reports ADD COLUMN IF NOT EXISTS project_summary text NOT NULL DEFAULT '';
ALTER TABLE public.status_reports ADD COLUMN IF NOT EXISTS snapshot jsonb;

-- One Page: five statuses like the External report (off_track is shown as "Delayed")
DO $$
DECLARE c text; col text;
BEGIN
  FOREACH col IN ARRAY ARRAY['overall_status', 'schedule_status', 'budget_status', 'scope_status', 'payment_status'] LOOP
    FOR c IN
      SELECT con.conname FROM pg_constraint con
      JOIN pg_attribute att ON att.attrelid = con.conrelid AND att.attnum = ANY (con.conkey)
      WHERE con.conrelid = 'public.monthly_reports'::regclass AND con.contype = 'c' AND att.attname = col
    LOOP
      EXECUTE format('ALTER TABLE public.monthly_reports DROP CONSTRAINT %I', c);
    END LOOP;
    EXECUTE format('ALTER TABLE public.monthly_reports ADD CONSTRAINT %I CHECK (%I IN (''on_track'', ''at_risk'', ''off_track'', ''completed'', ''not_started''))',
      'monthly_reports_' || col || '_check', col);
  END LOOP;
END $$;
