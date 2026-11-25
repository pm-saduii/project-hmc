-- The status trigger used to derive status purely from percent_complete on every
-- insert and on every update that touched percent_complete. That silently wiped
-- a manually chosen 'Block/Delay' (and the Status column of imported files).
--
-- New rule:
--   * 100%            -> 'Done'
--   * 'Block/Delay'   -> kept while the task is below 100%
--   * otherwise       -> 0% = 'Todo', 1-99% = 'In Progress'
-- On INSERT an explicit 'Block/Delay' is kept the same way.

CREATE OR REPLACE FUNCTION fn_tasks_sync_status()
RETURNS trigger AS $$
BEGIN
  IF COALESCE(NEW.percent_complete, 0) >= 100 THEN
    NEW.status := 'Done';
  ELSIF NEW.status = 'Block/Delay' THEN
    NEW.status := 'Block/Delay';
  ELSIF COALESCE(NEW.percent_complete, 0) <= 0 THEN
    NEW.status := 'Todo';
  ELSE
    NEW.status := 'In Progress';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_tasks_sync_status ON tasks;
CREATE TRIGGER trg_tasks_sync_status
BEFORE INSERT OR UPDATE OF percent_complete ON tasks
FOR EACH ROW
EXECUTE FUNCTION fn_tasks_sync_status();
