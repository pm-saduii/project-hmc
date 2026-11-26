-- Methodology v2: six phases (Planning · Design · Setup · Testing · Go-Live · Hypercare) as in the
-- company "Project Management Methodology" chart, combined with the existing steps and deliverables.
-- Codes are kept, so project statuses, dates, links, linked tasks and passed gates stay as they are.
-- Hypercare has no gate: Go-live sign-off is the last gate.
-- Safe to run more than once.

-- Icon and colour per phase (editable in Settings › Methodology › Phases)
ALTER TABLE public.methodology_phases ADD COLUMN IF NOT EXISTS icon  text NOT NULL DEFAULT '';
ALTER TABLE public.methodology_phases ADD COLUMN IF NOT EXISTS color text NOT NULL DEFAULT '';

-- Phases ---------------------------------------------------------------------
UPDATE public.methodology_phases SET name = 'Planning', icon = 'calendar', color = '#22C5DC', sort_order = 10,
  description = 'Scope, kick-off and the implementation roadmap.',
  gate = 'Implementation plan approved · Kick-off held and MOM sent' WHERE id = 'PS';
UPDATE public.methodology_phases SET name = 'Design', icon = 'monitor', color = '#14B8A6', sort_order = 20,
  description = 'Collect data, map the processes and confirm the Business Blueprint.',
  gate = 'Business Blueprint signed off' WHERE id = 'DS';
UPDATE public.methodology_phases SET name = 'Setup', icon = 'settings', color = '#0EA5B7', sort_order = 30,
  description = 'Configure, migrate data, customize and unit test.',
  gate = 'Configuration complete · Data migration results accepted · Unit tests passed' WHERE id = 'DV';
UPDATE public.methodology_phases SET name = 'Testing', icon = 'clipboard', color = '#38BDF8', sort_order = 40,
  description = 'UAT, integration testing, training and the payroll parallel run.',
  gate = 'UAT signed off · Payroll results signed off' WHERE id = 'DP';
UPDATE public.methodology_phases SET name = 'Go-Live', icon = 'rocket', color = '#2563EB', sort_order = 50,
  description = 'Prepare production and move the data across.',
  gate = 'Go-live sign-off signed' WHERE id = 'DL';
INSERT INTO public.methodology_phases (id, name, description, gate, sort_order, icon, color) VALUES
  ('HC', 'Hypercare', 'Support the customer after go-live.', '', 60, 'headset', '#1E3A8A')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description, gate = EXCLUDED.gate,
  sort_order = EXCLUDED.sort_order, icon = EXCLUDED.icon, color = EXCLUDED.color;

-- Steps ----------------------------------------------------------------------
-- 01 Planning
UPDATE public.methodology_steps SET phase_id = 'PS', name = 'Project Scope', sort_order = 10 WHERE id = 'PS1';
UPDATE public.methodology_steps SET phase_id = 'PS', name = 'Pre-Prep (Cloud Environment)', sort_order = 20 WHERE id = 'PS3';
UPDATE public.methodology_steps SET phase_id = 'PS', name = 'Project Kick-off', sort_order = 30 WHERE id = 'PS2';
INSERT INTO public.methodology_steps (id, phase_id, name, owner, objective, activities, sort_order) VALUES
  ('PS4', 'PS', 'Implementation Roadmap', 'HMC', 'Agree the implementation plan and milestones with the customer.',
   ARRAY['Draft the roadmap and milestones', 'Review it with the customer', 'Baseline the plan in Tasks'], 40)
ON CONFLICT (id) DO NOTHING;
-- 02 Design
UPDATE public.methodology_steps SET phase_id = 'DS', name = 'Data Collection & Cleansing', sort_order = 10 WHERE id = 'DS1';
INSERT INTO public.methodology_steps (id, phase_id, name, owner, objective, activities, sort_order) VALUES
  ('DS4', 'DS', 'Process Mapping', 'Joint', 'Map the customer''s as-is and to-be HR and payroll processes.',
   ARRAY['Workshops per process', 'Document the to-be processes', 'Confirm them with the process owners'], 20)
ON CONFLICT (id) DO NOTHING;
UPDATE public.methodology_steps SET phase_id = 'DS', name = 'GAP Analysis', sort_order = 30 WHERE id = 'DS2';
UPDATE public.methodology_steps SET phase_id = 'DS', name = 'Business Blueprint Confirmation', sort_order = 40 WHERE id = 'DS3';
-- 03 Setup
UPDATE public.methodology_steps SET phase_id = 'DV', name = 'System Configuration', sort_order = 10 WHERE id = 'DV1';
UPDATE public.methodology_steps SET phase_id = 'DV', name = 'Data Migration', sort_order = 20 WHERE id = 'DP1';
UPDATE public.methodology_steps SET phase_id = 'DV', name = 'Software Customization', sort_order = 30 WHERE id = 'DV2';
UPDATE public.methodology_steps SET phase_id = 'DV', name = 'Internal Unit Testing', sort_order = 40 WHERE id = 'DV4';
-- 04 Testing
UPDATE public.methodology_steps SET phase_id = 'DP', name = 'User Acceptance Testing', sort_order = 10 WHERE id = 'DP2';
UPDATE public.methodology_steps SET phase_id = 'DP', name = 'System Integration Testing', sort_order = 20,
  objective = 'Test the interfaces with the customer''s systems end to end.' WHERE id = 'DV3';
UPDATE public.methodology_steps SET phase_id = 'DP', name = 'Train to Client''s Trainer', sort_order = 30 WHERE id = 'DP3';
UPDATE public.methodology_steps SET phase_id = 'DP', name = 'Payroll Parallel Run Testing', sort_order = 40 WHERE id = 'DP4';
-- 05 Go-Live
INSERT INTO public.methodology_steps (id, phase_id, name, owner, objective, activities, sort_order) VALUES
  ('DL3', 'DL', 'Prep Production Environment', 'HMC', 'Get production ready for the cut-over.',
   ARRAY['Production environment and users ready', 'Cut-over plan agreed', 'Go / No-Go decision'], 10)
ON CONFLICT (id) DO NOTHING;
UPDATE public.methodology_steps SET phase_id = 'DL', name = 'Data Transition to Production', sort_order = 20 WHERE id = 'DL1';
-- 06 Hypercare
UPDATE public.methodology_steps SET phase_id = 'HC', name = 'After Go-live Customer Support', sort_order = 10 WHERE id = 'DL2';

-- Deliverables ---------------------------------------------------------------
-- 01 Planning
UPDATE public.methodology_deliverables SET phase_id = 'PS', step_id = 'PS4', name = 'Implementation Plan', short_name = 'Implementation Plan', sort_order = 10 WHERE id = 'PLAN';
UPDATE public.methodology_deliverables SET phase_id = 'PS', step_id = 'PS1', sort_order = 20 WHERE id = 'CHR';
UPDATE public.methodology_deliverables SET phase_id = 'PS', step_id = 'PS1', sort_order = 30 WHERE id = 'BUD';
UPDATE public.methodology_deliverables SET phase_id = 'PS', step_id = 'PS3', sort_order = 40 WHERE id = 'ENV';
UPDATE public.methodology_deliverables SET phase_id = 'PS', step_id = 'PS2', sort_order = 50 WHERE id = 'KO';
UPDATE public.methodology_deliverables SET phase_id = 'PS', step_id = 'PS2', sort_order = 60 WHERE id = 'MOMK';
-- 02 Design
INSERT INTO public.methodology_deliverables (id, phase_id, step_id, name, short_name, format, requires_signoff, internal_only, owner, sort_order) VALUES
  ('TOBE', 'DS', 'DS4', 'Confirmed To-be processes', 'To-be processes', 'Process maps', false, false, 'Joint', 10)
ON CONFLICT (id) DO NOTHING;
UPDATE public.methodology_deliverables SET phase_id = 'DS', step_id = 'DS3', sort_order = 20 WHERE id = 'BB';
UPDATE public.methodology_deliverables SET phase_id = 'DS', step_id = 'DS2', sort_order = 30 WHERE id = 'REQ';
UPDATE public.methodology_deliverables SET phase_id = 'DS', step_id = 'DS1', sort_order = 40 WHERE id = 'APX';
-- 03 Setup
UPDATE public.methodology_deliverables SET phase_id = 'DV', step_id = 'DV2', name = 'Functional Specification', short_name = 'Functional spec', sort_order = 10 WHERE id = 'FS';
UPDATE public.methodology_deliverables SET phase_id = 'DV', step_id = 'DV1', sort_order = 20 WHERE id = 'CFG';
UPDATE public.methodology_deliverables SET phase_id = 'DV', step_id = 'DP1', name = 'Data migration results', short_name = 'Migration results', sort_order = 30 WHERE id = 'MIG';
UPDATE public.methodology_deliverables SET phase_id = 'DV', step_id = 'DV4', sort_order = 40 WHERE id = 'UT';
-- 04 Testing
INSERT INTO public.methodology_deliverables (id, phase_id, step_id, name, short_name, format, requires_signoff, internal_only, owner, sort_order) VALUES
  ('TDOC', 'DP', 'DP2', 'Test document', 'Test document', 'Test scenarios', false, false, 'Joint', 10)
ON CONFLICT (id) DO NOTHING;
UPDATE public.methodology_deliverables SET phase_id = 'DP', step_id = 'DP2', name = 'UAT sign-off', short_name = 'UAT', sort_order = 20 WHERE id = 'UAT';
UPDATE public.methodology_deliverables SET phase_id = 'DP', step_id = 'DP3', name = 'Training Material', short_name = 'Training', sort_order = 30 WHERE id = 'TRN';
UPDATE public.methodology_deliverables SET phase_id = 'DP', step_id = 'DP4', name = 'Payroll results sign-off', short_name = 'Payroll results', sort_order = 40 WHERE id = 'PAR';
-- 05 Go-Live
INSERT INTO public.methodology_deliverables (id, phase_id, step_id, name, short_name, format, requires_signoff, internal_only, owner, sort_order) VALUES
  ('CUT', 'DL', 'DL3', 'Cut-over plan', 'Cut-over plan', 'Plan', false, false, 'HMC', 10),
  ('REC', 'DL', 'DL1', 'Data Reconciliation', 'Reconciliation', 'Reconciliation report', false, false, 'Joint', 20)
ON CONFLICT (id) DO NOTHING;
UPDATE public.methodology_deliverables SET phase_id = 'DL', step_id = 'DL3', sort_order = 30 WHERE id = 'GNG';
UPDATE public.methodology_deliverables SET phase_id = 'DL', step_id = 'DL1', sort_order = 40 WHERE id = 'GL';
-- 06 Hypercare
UPDATE public.methodology_deliverables SET phase_id = 'HC', step_id = 'DL2', sort_order = 10 WHERE id = 'CSS';
UPDATE public.methodology_deliverables SET phase_id = 'HC', step_id = 'DL2', sort_order = 20 WHERE id = 'CLS';
