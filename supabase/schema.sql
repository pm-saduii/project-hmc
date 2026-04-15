-- ============================================================================
-- ProjectMS Enterprise — Supabase PostgreSQL Schema
-- ============================================================================
-- Run this in Supabase SQL Editor to set up the database.
-- Includes: tables, indexes, RLS policies, realtime, and helper functions.
-- ============================================================================

-- 0. Extensions
create extension if not exists "uuid-ossp";

-- ============================================================================
-- 1. PROFILES (linked to auth.users)
-- ============================================================================
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text,
  full_name   text,
  avatar_url  text,
  role        text not null default 'member'
                check (role in ('admin','pm','member','client')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data ->> 'role', 'member')
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================================
-- 2. PROJECTS
-- ============================================================================
create table if not exists public.projects (
  id          uuid primary key default uuid_generate_v4(),
  name        text not null,
  code        text not null default '',
  client      text not null default '',
  status      text not null default 'Planning'
                check (status in ('Planning','Req & Design','Setup','Testing','Go Live','Hyper Care')),
  start_date  text not null default '',
  end_date    text not null default '',
  description text not null default '',
  color       text not null default '#4F46E5',
  created_by  uuid references public.profiles(id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ============================================================================
-- 3. PROJECT MEMBERS (access control + team)
-- ============================================================================
create table if not exists public.members (
  id          uuid primary key default uuid_generate_v4(),
  project_id  uuid not null references public.projects(id) on delete cascade,
  name        text not null default '',
  nickname    text not null default '',
  role        text not null default '',
  position    text not null default '',
  email       text not null default '',
  tel         text not null default '',
  type        text not null default 'internal' check (type in ('internal','client')),
  notes       text not null default '',
  user_id     uuid references public.profiles(id),
  created_at  timestamptz not null default now()
);

create index if not exists idx_members_project on public.members(project_id);
create index if not exists idx_members_user    on public.members(user_id);

-- ============================================================================
-- 4. TASKS
-- ============================================================================
create table if not exists public.tasks (
  id               uuid primary key default uuid_generate_v4(),
  project_id       uuid not null references public.projects(id) on delete cascade,
  wbs              text not null default '',
  task_name        text not null default '',
  start_date       text not null default '',
  end_date         text not null default '',
  actual_finish    text not null default '',
  duration         integer not null default 0,
  percent_complete integer not null default 0,
  resource         text not null default '',
  related_task     text not null default '',
  parent_id        text not null default '',
  level            integer not null default 0,
  "order"          integer not null default 0,
  created_at       timestamptz not null default now()
);

create index if not exists idx_tasks_project on public.tasks(project_id);

-- ============================================================================
-- 5. MILESTONES
-- ============================================================================
create table if not exists public.milestones (
  id           uuid primary key default uuid_generate_v4(),
  project_id   uuid not null references public.projects(id) on delete cascade,
  phase        text not null default '',
  name         text not null default '',
  percent      numeric not null default 0,
  amount       numeric not null default 0,
  due_date     text not null default '',
  billing_date text not null default '',
  notes        text not null default '',
  status       text not null default 'pending' check (status in ('pending','billed','paid')),
  created_at   timestamptz not null default now()
);

create index if not exists idx_milestones_project on public.milestones(project_id);

-- ============================================================================
-- 6. EFFORTS
-- ============================================================================
create table if not exists public.efforts (
  id             uuid primary key default uuid_generate_v4(),
  project_id     uuid not null references public.projects(id) on delete cascade,
  module         text not null default '',
  budget_amount  numeric not null default 0,
  budget_manday  numeric not null default 0,
  created_at     timestamptz not null default now()
);

create index if not exists idx_efforts_project on public.efforts(project_id);

-- ============================================================================
-- 7. EFFORT MONTHLY
-- ============================================================================
create table if not exists public.effort_monthly (
  id         uuid primary key default uuid_generate_v4(),
  effort_id  uuid not null references public.efforts(id) on delete cascade,
  month      text not null default '',
  manday     numeric not null default 0,
  unique(effort_id, month)
);

create index if not exists idx_effort_monthly_effort on public.effort_monthly(effort_id);

-- ============================================================================
-- 8. CHANGE REQUESTS
-- ============================================================================
create table if not exists public.change_requests (
  id            uuid primary key default uuid_generate_v4(),
  project_id    uuid not null references public.projects(id) on delete cascade,
  cr_id         text not null default '',
  title         text not null default '',
  requested_by  text not null default '',
  request_date  text not null default '',
  approved_by   text not null default '',
  approval_date text not null default '',
  total_manday  numeric not null default 0,
  discount      numeric not null default 0,
  status        text not null default 'Draft'
                  check (status in ('Draft','Submitted','Under Review','Approved','Rejected','Implemented','Close')),
  notes         text not null default '',
  created_at    timestamptz not null default now()
);

create index if not exists idx_cr_project on public.change_requests(project_id);

-- ============================================================================
-- 9. CR ITEMS
-- ============================================================================
create table if not exists public.cr_items (
  id       uuid primary key default uuid_generate_v4(),
  cr_id    uuid not null references public.change_requests(id) on delete cascade,
  detail   text not null default '',
  manday   numeric not null default 0
);

create index if not exists idx_cr_items_cr on public.cr_items(cr_id);

-- ============================================================================
-- 10. ISSUES
-- ============================================================================
create table if not exists public.issues (
  id            uuid primary key default uuid_generate_v4(),
  project_id    uuid not null references public.projects(id) on delete cascade,
  issue_date    text not null default '',
  title         text not null default '',
  description   text not null default '',
  reported_by   text not null default '',
  assigned_to   text not null default '',
  status        text not null default 'Open'
                  check (status in ('Open','In Progress','Resolved','Blocked')),
  resolved_date text not null default '',
  notes         text not null default '',
  created_at    timestamptz not null default now()
);

create index if not exists idx_issues_project on public.issues(project_id);

-- ============================================================================
-- 11. RISKS
-- ============================================================================
create table if not exists public.risks (
  id          uuid primary key default uuid_generate_v4(),
  project_id  uuid not null references public.projects(id) on delete cascade,
  risk_date   text not null default '',
  title       text not null default '',
  description text not null default '',
  probability text not null default 'Medium' check (probability in ('Low','Medium','High')),
  impact      text not null default 'Medium' check (impact in ('Low','Medium','High')),
  mitigation  text not null default '',
  owner       text not null default '',
  status      text not null default 'Monitoring'
                check (status in ('Monitoring','Mitigating','Closed')),
  created_at  timestamptz not null default now()
);

create index if not exists idx_risks_project on public.risks(project_id);

-- ============================================================================
-- 12. ROW LEVEL SECURITY
-- ============================================================================

-- Helper: check if user is admin
create or replace function public.is_admin()
returns boolean
language sql security definer stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- Helper: check if user is member of project
create or replace function public.is_project_member(p_project_id uuid)
returns boolean
language sql security definer stable
as $$
  select exists (
    select 1 from public.members
    where project_id = p_project_id and user_id = auth.uid()
  )
  or public.is_admin()
  or exists (
    select 1 from public.projects
    where id = p_project_id and created_by = auth.uid()
  );
$$;

-- PROFILES
alter table public.profiles enable row level security;

create policy "Users can view all profiles"
  on public.profiles for select using (true);

create policy "Users can update own profile"
  on public.profiles for update using (auth.uid() = id);

-- PROJECTS
alter table public.projects enable row level security;

create policy "Anyone authenticated can view projects"
  on public.projects for select using (auth.uid() is not null);

create policy "Authenticated users can create projects"
  on public.projects for insert with check (auth.uid() is not null);

create policy "Project creator or admin can update"
  on public.projects for update using (
    created_by = auth.uid() or public.is_admin()
  );

create policy "Project creator or admin can delete"
  on public.projects for delete using (
    created_by = auth.uid() or public.is_admin()
  );

-- MEMBERS
alter table public.members enable row level security;

create policy "Project members can view members"
  on public.members for select using (auth.uid() is not null);

create policy "Authenticated can manage members"
  on public.members for insert with check (auth.uid() is not null);

create policy "Authenticated can update members"
  on public.members for update using (auth.uid() is not null);

create policy "Authenticated can delete members"
  on public.members for delete using (auth.uid() is not null);

-- TASKS
alter table public.tasks enable row level security;

create policy "Authenticated can view tasks"
  on public.tasks for select using (auth.uid() is not null);

create policy "Authenticated can insert tasks"
  on public.tasks for insert with check (auth.uid() is not null);

create policy "Authenticated can update tasks"
  on public.tasks for update using (auth.uid() is not null);

create policy "Authenticated can delete tasks"
  on public.tasks for delete using (auth.uid() is not null);

-- MILESTONES
alter table public.milestones enable row level security;

create policy "Authenticated can view milestones"
  on public.milestones for select using (auth.uid() is not null);

create policy "Authenticated can insert milestones"
  on public.milestones for insert with check (auth.uid() is not null);

create policy "Authenticated can update milestones"
  on public.milestones for update using (auth.uid() is not null);

create policy "Authenticated can delete milestones"
  on public.milestones for delete using (auth.uid() is not null);

-- EFFORTS
alter table public.efforts enable row level security;

create policy "Authenticated can view efforts"
  on public.efforts for select using (auth.uid() is not null);

create policy "Authenticated can insert efforts"
  on public.efforts for insert with check (auth.uid() is not null);

create policy "Authenticated can update efforts"
  on public.efforts for update using (auth.uid() is not null);

create policy "Authenticated can delete efforts"
  on public.efforts for delete using (auth.uid() is not null);

-- EFFORT_MONTHLY
alter table public.effort_monthly enable row level security;

create policy "Authenticated can view effort_monthly"
  on public.effort_monthly for select using (auth.uid() is not null);

create policy "Authenticated can insert effort_monthly"
  on public.effort_monthly for insert with check (auth.uid() is not null);

create policy "Authenticated can update effort_monthly"
  on public.effort_monthly for update using (auth.uid() is not null);

create policy "Authenticated can delete effort_monthly"
  on public.effort_monthly for delete using (auth.uid() is not null);

-- CHANGE_REQUESTS
alter table public.change_requests enable row level security;

create policy "Authenticated can view CRs"
  on public.change_requests for select using (auth.uid() is not null);

create policy "Authenticated can insert CRs"
  on public.change_requests for insert with check (auth.uid() is not null);

create policy "Authenticated can update CRs"
  on public.change_requests for update using (auth.uid() is not null);

create policy "Authenticated can delete CRs"
  on public.change_requests for delete using (auth.uid() is not null);

-- CR_ITEMS
alter table public.cr_items enable row level security;

create policy "Authenticated can view CR items"
  on public.cr_items for select using (auth.uid() is not null);

create policy "Authenticated can insert CR items"
  on public.cr_items for insert with check (auth.uid() is not null);

create policy "Authenticated can update CR items"
  on public.cr_items for update using (auth.uid() is not null);

create policy "Authenticated can delete CR items"
  on public.cr_items for delete using (auth.uid() is not null);

-- ISSUES
alter table public.issues enable row level security;

create policy "Authenticated can view issues"
  on public.issues for select using (auth.uid() is not null);

create policy "Authenticated can insert issues"
  on public.issues for insert with check (auth.uid() is not null);

create policy "Authenticated can update issues"
  on public.issues for update using (auth.uid() is not null);

create policy "Authenticated can delete issues"
  on public.issues for delete using (auth.uid() is not null);

-- RISKS
alter table public.risks enable row level security;

create policy "Authenticated can view risks"
  on public.risks for select using (auth.uid() is not null);

create policy "Authenticated can insert risks"
  on public.risks for insert with check (auth.uid() is not null);

create policy "Authenticated can update risks"
  on public.risks for update using (auth.uid() is not null);

create policy "Authenticated can delete risks"
  on public.risks for delete using (auth.uid() is not null);

-- ============================================================================
-- 13. REALTIME
-- ============================================================================
-- Enable realtime for key tables
alter publication supabase_realtime add table public.projects;
alter publication supabase_realtime add table public.tasks;
alter publication supabase_realtime add table public.members;
alter publication supabase_realtime add table public.milestones;
alter publication supabase_realtime add table public.issues;
alter publication supabase_realtime add table public.risks;
alter publication supabase_realtime add table public.change_requests;

-- ============================================================================
-- 14. UPDATED_AT TRIGGER
-- ============================================================================
create or replace function public.update_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_updated_at
  before update on public.projects
  for each row execute function public.update_updated_at();

create trigger set_updated_at
  before update on public.profiles
  for each row execute function public.update_updated_at();
