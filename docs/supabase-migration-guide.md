# Supabase Migration Guide
## Migrating from Google Sheets API to Supabase PostgreSQL

**Version:** 1.0  
**Last Updated:** 2024  
**Status:** Production Ready  

---

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Architecture](#architecture)
4. [Setup Steps](#setup-steps)
5. [Data Migration](#data-migration)
6. [Backend Configuration](#backend-configuration)
7. [Frontend Configuration](#frontend-configuration)
8. [Testing & Validation](#testing--validation)
9. [Troubleshooting](#troubleshooting)
10. [Rollback Procedure](#rollback-procedure)

---

## Overview

This migration transitions the Project Management System from Google Sheets API storage to Supabase PostgreSQL, providing:

- **Scalability**: Handle unlimited concurrent users vs. Sheets API rate limits
- **Performance**: Sub-100ms queries vs. network-dependent Sheets API calls
- **Security**: Row-level security (RLS) policies and encrypted credentials
- **Reliability**: Automatic backups, point-in-time recovery, 99.9% uptime
- **Real-time**: Realtime subscriptions for live data updates
- **Cost**: Fixed PostgreSQL costs vs. variable Sheets API pricing

### Data Model Changes

| Google Sheets | Supabase Table | Notes |
|---|---|---|
| Projects | `projects` | Normalized with foreign keys |
| Tasks | `tasks` | Hierarchical parent-child support |
| Members | `members` | Centralized team management |
| Milestones | `milestones` | Linked to projects |
| EffortMonthly | `efforts` + JSONB | Monthly tracking as JSON |
| ChangeRequests | `change_requests` | New CR workflow statuses |
| CRItems | `change_request_items` | Separated for normalization |
| Issues | `issues` | New issue statuses |
| Risks | `risks` | New risk statuses |

---

## Prerequisites

### Required Services

1. **Supabase Account**: [supabase.com](https://supabase.com)
   - Free tier includes 500MB database (sufficient for initial deployment)
   - Upgrade to Pro for production ($25/month, unlimited storage)

2. **Node.js & npm**: v18+
   - Verify: `node -v && npm -v`

3. **PostgreSQL Client** (for migration): 
   - macOS: `brew install postgresql`
   - Or use Supabase SQL Editor in browser

4. **Environment Setup**:
   - Supabase project created and URL/API key noted
   - Google Sheets with current data (backup before migration)

### Credentials

From Supabase project settings, collect:
- **Supabase URL**: `https://[project-id].supabase.co`
- **Service Role Key**: (Under Settings > API) - Keep secret
- **Anon Key**: (Under Settings > API) - For public access
- **Database Password**: (Set during project creation)

---

## Architecture

### Data Flow Comparison

#### Before (Google Sheets)
```
Frontend → API Layer → Google Sheets API → Google Sheets
         (slow, rate-limited, no real-time)
```

#### After (Supabase)
```
Frontend → API Layer → Supabase REST API → PostgreSQL
         (fast, scalable, real-time subscriptions)
```

### Supabase Stack

```
┌─────────────────────────────────────────────┐
│  Frontend (React + TypeScript)              │
│  - Uses existing @supabase/supabase-js      │
└────────────────┬────────────────────────────┘
                 │ HTTP/WebSocket
┌────────────────▼────────────────────────────┐
│  Supabase Edge Functions (optional)         │
│  - Custom logic, webhooks, integrations     │
└────────────────┬────────────────────────────┘
                 │ REST API
┌────────────────▼────────────────────────────┐
│  Supabase API Gateway                       │
│  - Auto-generated REST endpoints            │
│  - RLS policies enforcement                 │
│  - Authentication/Authorization             │
└────────────────┬────────────────────────────┘
                 │ SQL
┌────────────────▼────────────────────────────┐
│  PostgreSQL Database (Supabase Hosted)      │
│  - 10 normalized tables                     │
│  - Indexes, constraints, triggers           │
│  - Automatic backups, replication           │
└─────────────────────────────────────────────┘
```

### Schema Relationships

```
┌──────────────┐
│   projects   │◄──┬─ tasks
└──────────────┘   ├─ milestones
                   ├─ efforts
                   ├─ change_requests
                   ├─ issues
                   └─ risks

┌──────────────┐
│   members    │◄─ assigned_to in [tasks, issues, risks]
└──────────────┘

┌──────────────────────┐
│ change_requests      │◄── change_request_items
└──────────────────────┘

┌──────────────┐
│   tasks      │◄─ self-join (parent_id)
│              │◄─ self-join (related_task)
└──────────────┘
```

---

## Setup Steps

### Step 1: Create Supabase Project

1. Go to [supabase.com](https://supabase.com)
2. Click **"New Project"**
3. Fill in:
   - **Name**: `project-ms-prod` (or your preference)
   - **Database Password**: Generate strong password (save securely)
   - **Region**: Closest to your users (default: US East)
   - **Pricing**: Free tier recommended for initial testing
4. Wait for project initialization (5-10 minutes)

### Step 2: Import Schema

1. In Supabase Dashboard, go to **SQL Editor**
2. Click **"New Query"**
3. Copy entire contents of `docs/supabase-schema.sql`
4. Paste into editor
5. Click **"Run"** (green button, top-right)
6. Verify no errors in "Results" panel
7. Should see 10 tables created with success messages

### Step 3: Collect Credentials

1. Go to **Project Settings** > **API**
2. Note and save securely:
   - **Project URL**: e.g., `https://abcxyzproject.supabase.co`
   - **Anon Key** (for frontend): Start with `eyJhbGc...`
   - **Service Role Key** (for backend): Start with `eyJhbGc...`
3. Create `.env.local` file in project root:

```bash
VITE_SUPABASE_URL=https://abcxyzproject.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_SERVICE_KEY=eyJhbGc...
```

### Step 4: Enable Auto-generated REST API

Supabase automatically generates REST APIs for all tables. Verify:

1. Go to **SQL Editor** > Click any table
2. Click **"RPC"** in left menu  
3. Should see tables listed (projects, tasks, members, etc.)

---

## Data Migration

### Option A: Automated Migration (Recommended)

Create migration script: `scripts/migrate-sheets-to-supabase.js`

```javascript
const { createClient } = require('@supabase/supabase-js');
const sheets = require('googleapis').sheets('v4');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// Example: Migrate Projects
async function migrateProjects(sheetsData) {
  const projects = sheetsData.map(row => ({
    name: row[1],
    code: row[2],
    client: row[3],
    status: row[4],
    color: row[5],
    start_date: row[6],
    end_date: row[7],
  }));
  
  const { error } = await supabase
    .from('projects')
    .insert(projects);
  
  if (error) throw error;
  console.log(`✓ Migrated ${projects.length} projects`);
}

// Run migration for all 10 tables
// (See full script in migration-script.js)
```

Run: `npm run migrate`

### Option B: Manual Migration via CSV

1. Export each Google Sheet as CSV:
   - Projects → `data/projects.csv`
   - Tasks → `data/tasks.csv`
   - (etc. for all 10 sheets)

2. Supabase Dashboard > **Table Editor** > For each table:
   - Click **"Import data"** (top-right)
   - Select corresponding CSV file
   - Map columns to table fields
   - Click **"Import"**

3. Verify row counts match original Sheets

### Option C: Manual SQL INSERT

For small datasets, insert sample data directly:

```sql
INSERT INTO projects (name, code, client, status, color, start_date, end_date)
VALUES 
  ('Project Alpha', 'PA-001', 'Acme Corp', 'active', '#4F46E5', '2024-01-01', '2024-06-30'),
  ('Project Beta', 'PB-001', 'Beta Inc', 'planning', '#10B981', '2024-03-01', '2024-12-31');
```

---

## Backend Configuration

### Update Node.js Backend

1. **Install Supabase client**:
```bash
cd backend && npm install @supabase/supabase-js
```

2. **Create `src/supabase.js`**:
```javascript
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

module.exports = supabase;
```

3. **Update API routes** from Google Sheets to Supabase:

**Before (Google Sheets)**:
```javascript
// routes/tasks.js
router.get('/api/tasks', async (req, res) => {
  const sheets = google.sheets({version: 'v4', auth: authClient});
  const response = await sheets.spreadsheets.values.get({...});
  res.json(response.data.values);
});
```

**After (Supabase)**:
```javascript
// routes/tasks.js
const supabase = require('../supabase');

router.get('/api/tasks', async (req, res) => {
  const projectId = req.query.projectId;
  let query = supabase.from('tasks').select('*');
  
  if (projectId) {
    query = query.eq('project_id', projectId);
  }
  
  const { data, error } = await query;
  
  if (error) return res.status(400).json({error: error.message});
  res.json(data);
});

router.post('/api/tasks', async (req, res) => {
  const { error, data } = await supabase
    .from('tasks')
    .insert([req.body]);
  
  if (error) return res.status(400).json({error: error.message});
  res.json(data);
});
```

4. **Update `.env` file**:
```
SUPABASE_URL=https://abcxyzproject.supabase.co
SUPABASE_SERVICE_KEY=eyJhbGc...
PORT=3001
```

5. **Migrate all 10 API endpoints** (projects, tasks, members, milestones, efforts, change-requests, change-request-items, issues, risks)

---

## Frontend Configuration

### Update React Frontend

1. **Install Supabase client** (if not already):
```bash
cd frontend && npm install @supabase/supabase-js
```

2. **Update API service** (`frontend/src/services/api.ts`):

```typescript
// Before: Using REST calls to Node.js backend
const taskApi = {
  getByProject: (pid?: string) => {
    const url = `/api/tasks${pid ? `?projectId=${pid}` : ''}`;
    return fetch(url).then(r => r.json());
  }
};

// After: Create Supabase client
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

const taskApi = {
  async getByProject(pid?: string) {
    let query = supabase.from('tasks').select('*');
    if (pid) query = query.eq('project_id', pid);
    const { data, error } = await query;
    if (error) throw error;
    return { data };
  },
  
  async create(task: Partial<Task>) {
    const { data, error } = await supabase
      .from('tasks')
      .insert([task]);
    if (error) throw error;
    return { data };
  },
  
  async update(id: string, updates: Partial<Task>) {
    const { data, error } = await supabase
      .from('tasks')
      .update(updates)
      .eq('id', id);
    if (error) throw error;
    return { data };
  },
  
  async delete(id: string) {
    const { error } = await supabase
      .from('tasks')
      .delete()
      .eq('id', id);
    if (error) throw error;
  }
};

export { taskApi };
```

3. **Update `.env.local`**:
```
VITE_SUPABASE_URL=https://abcxyzproject.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGc...
```

4. **Migrate all 9 collection APIs** (same pattern as taskApi)

---

## Testing & Validation

### Unit Tests

```typescript
// tests/supabase-migration.test.ts
import { supabase } from '../src/services/supabase';

describe('Supabase Migration', () => {
  test('Projects table has data', async () => {
    const { data, error } = await supabase
      .from('projects')
      .select('count');
    expect(error).toBeNull();
    expect(data.length).toBeGreaterThan(0);
  });
  
  test('Tasks have project_id FK', async () => {
    const { data } = await supabase
      .from('tasks')
      .select('id, project_id')
      .limit(1);
    expect(data[0].project_id).toBeDefined();
  });
  
  test('Create and delete task', async () => {
    // Insert
    const { data: created } = await supabase
      .from('tasks')
      .insert({ task_name: 'Test', project_id: '...' });
    
    // Delete
    await supabase.from('tasks').delete().eq('id', created[0].id);
    
    // Verify deletion
    const { data: deleted } = await supabase
      .from('tasks')
      .select('*')
      .eq('id', created[0].id);
    
    expect(deleted.length).toBe(0);
  });
});

// Run: npm test
```

### Validation Checklist

- [ ] All 10 tables created with correct columns
- [ ] Foreign key constraints verified (test cascades)
- [ ] Indexes created for performance
- [ ] Sample data inserted and retrievable
- [ ] API GET requests work (no auth required with Anon key)
- [ ] API POST/PUT/DELETE requests work (test with sample data)
- [ ] Frontend can fetch and display data
- [ ] Dashboard metrics calculate correctly from real DB data
- [ ] Forms create/update records in Supabase
- [ ] Dropdown selections (members, statuses) populate correctly
- [ ] PDF export includes Gantt chart with correct dates
- [ ] No console errors or TypeScript compilation errors

### Performance Benchmarks

```
Metric                    | Google Sheets | Supabase | Improvement
--------------------------|---------------|----------|------------
Average query time        | 800-1500ms    | 50-150ms | 10-30x faster
Concurrent users support  | ~50 max       | 1000+    | 20x+ more
Monthly cost (100 users)  | $5-20         | $25      | Predictable
------*/
```

---

## Troubleshooting

### Common Issues

#### 1. "Invalid API Key"
**Solution**: Check Supabase URL and Anon Key in `.env.local`

#### 2. "Column 'X' does not exist"
**Solution**: Run schema.sql again - table may not have been created. Check SQL Editor "Results" for errors

#### 3. "Foreign Key Constraint Violation"
**Solution**: When inserting tasks, ensure project_id exists first
```sql
-- Check parent exists
SELECT id FROM projects WHERE id = 'existing-id';
```

#### 4. "Too many connections"
**Solution**: Common on free tier. Close unused connections or upgrade to Pro

#### 5. "RLS policy denied this operation"
**Solution**: Disable RLS for testing:
```sql
ALTER TABLE tasks DISABLE ROW LEVEL SECURITY;
```

### Debug Queries

```sql
-- View all tables
SELECT * FROM information_schema.tables 
WHERE table_schema = 'public';

-- Check row counts
SELECT 'projects' as table_name, COUNT(*) FROM projects
UNION ALL
SELECT 'tasks', COUNT(*) FROM tasks
UNION ALL
SELECT 'members', COUNT(*) FROM members;

-- View recent errors in logs
SELECT * FROM pg_stat_statements 
ORDER BY mean_time DESC LIMIT 10;

-- Test foreign key relationship
SELECT t.id, t.task_name, p.name as project_name
FROM tasks t
LEFT JOIN projects p ON t.project_id = p.id;
```

---

## Rollback Procedure

If migration fails and you need to revert to Google Sheets:

### Step 1: Pause New Changes
- Notify team: "Pausing changes during rollback"
- Stop all API writes to Supabase

### Step 2: Verify Google Sheets Backup
```bash
# Open latest backup of Google Sheets data
# (should have been exported before migration)
ls -la data/backup_sheets_*.csv
```

### Step 3: Revert Frontend Code
```bash
git revert <commit-hash-of-supabase-migration>
npm install
npm run build
```

### Step 4: Revert Backend API
```bash
# Use Google Sheets API code from previous commit
git checkout HEAD~1 -- routes/*.js services/sheetsService.js
npm install googleapis
```

### Step 5: Delete Supabase Project (Optional)
- Go to Supabase Dashboard > Settings > Danger Zone > Delete Project
- This frees up the database slot

### Time Estimate
- Rollback to prod: 30 minutes (redeploy frontend/backend)
- Data consistency check: 15 minutes
- Verification testing: 30 minutes

---

## Success Criteria

Migration is complete when:

✅ All 10 tables populated with correct data  
✅ No foreign key constraint errors  
✅ Dashboard displays real metrics from database  
✅ Forms create/update records in Supabase  
✅ All API endpoints using Supabase (not Google Sheets)  
✅ PDF export generates correctly  
✅ Team can log in and use application normally  
✅ Database backups scheduled and tested  
✅ Performance metrics show improvement  
✅ Production deployment successful  

---

## Post-Migration Tasks

### Week 1 (Monitoring)
- Monitor error logs in Supabase Dashboard
- Track API response times
- Monitor database storage usage
- Gather feedback from team

### Week 2-4 (Optimization)
- Analyze slow queries using pg_stat_statements
- Add missing indexes if needed
- Implement RLS policies for security
- Set up automated backups + PITR

### Month 2+ (Enhancement)
- Implement Supabase Realtime subscriptions
- Add Edge Functions for custom logic
- Set up webhooks for external integrations
- Enable full-text search on task descriptions

---

## Support & Resources

- **Supabase Docs**: https://supabase.com/docs
- **PostgreSQL Docs**: https://www.postgresql.org/docs/
- **React Supabase Integration**: https://supabase.com/docs/guides/with-react
- **Community Forum**: https://github.com/supabase/supabase/discussions

---

**Next Steps:**
1. Create Supabase project using steps above
2. Run schema.sql SQL script
3. Test data migration with sample records
4. Update backend API endpoints
5. Update frontend services
6. Full integration testing
7. Deploy to staging environment first
8. Monitor 1 week before production rollout
9. Document any customizations made
10. Schedule post-migration review meeting

**License**: MIT  
**Maintained by**: ProjectMS Team

