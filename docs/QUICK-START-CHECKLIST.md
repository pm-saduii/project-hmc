# Deployment & Migration Quick Start Checklist

This is a **step-by-step execution checklist** for deploying your Project Management System with Supabase and auto-deployment to Railway & Vercel.

**Total time to complete: 2-3 hours**

---

## Phase 1: Prerequisites Setup (30 minutes)

### Step 1.1: Create Supabase Account
- [ ] Go to https://supabase.com
- [ ] Click "Start your project" → Sign up with GitHub
- [ ] Create a new project:
  - Name: `project-ms`
  - Region: Choose closest to your users
  - Password: Save securely
- [ ] Wait 2-3 minutes for database initialization
- [ ] Collect credentials from Settings > API:
  - [ ] Project URL: `https://xxxxx.supabase.co`
  - [ ] Anon Key: `eyJhbGc...` (starts with eyJ)
  - [ ] Service Role Key: `eyJhbGc...` (starts with eyJ)
  - [ ] Database Password: (shown during setup)

### Step 1.2: Create Railway Account
- [ ] Go to https://railway.app
- [ ] Sign up with GitHub (authorize repository access)
- [ ] Create new project → Blank project
- [ ] Link GitHub repository: Project MS (or your fork)
- [ ] Collect token from Account > API Tokens:
  - [ ] Railway API Token: `[Your token]`

### Step 1.3: Setup Vercel Account
- [ ] Go to https://vercel.com
- [ ] Sign up with GitHub (authorize repository access)
- [ ] Create new team or use personal account
- [ ] Collect tokens from Settings > Tokens:
  - [ ] VERCEL_TOKEN: Personal access token
  - [ ] VERCEL_ORG_ID: From Settings > General
  - [ ] VERCEL_PROJECT_ID: (will be assigned after first import)

---

## Phase 2: Database Setup (10 minutes)

### Step 2.1: Create Database Schema
- [ ] In Supabase Dashboard, go to SQL Editor
- [ ] Create new query
- [ ] Copy entire contents of `docs/supabase-schema.sql`
- [ ] Paste into SQL editor
- [ ] Click "Run"
- [ ] Verify all 10 tables created:
  ```
  projects, tasks, members, milestones, 
  efforts, change_requests, issues, risks, 
  users, audit_log
  ```

### Step 2.2: Verify Schema
- [ ] In Supabase Dashboard, go to Table Editor
- [ ] Check each table has correct columns:
  - [ ] projects: id, name, code, client, status, color, start_date, end_date, description
  - [ ] tasks: id, project_id, name, status, progress, start_date, end_date
  - [ ] members: id, name, email, role, status
  - [ ] (and others - see schema file)

---

## Phase 3: GitHub Configuration (20 minutes)

### Step 3.1: Create/Update GitHub Repository
- [ ] Create GitHub repository or update existing:
  ```bash
  # If creating new repo
  git init
  git add .
  git commit -m "Initial commit: Phase 1-4 completed"
  git branch -M main
  git remote add origin https://github.com/YOUR-USERNAME/project-ms.git
  git push -u origin main
  ```

### Step 3.2: Copy Workflow Files (Already Created)
- [ ] Verify `.github/workflows/` directory exists
- [ ] Check for these files:
  - [ ] `.github/workflows/deploy-backend.yml` ✅ (created)
  - [ ] `.github/workflows/deploy-frontend.yml` ✅ (created)

### Step 3.3: Copy Environment Templates (Already Created)
- [ ] Verify these files exist:
  - [ ] `frontend/.env.example` ✅ (created)
  - [ ] `backend/.env.example` ✅ (created)

### Step 3.4: Add GitHub Secrets
1. Go to GitHub Repository → Settings → Secrets and variables → Actions
2. Click "New repository secret" for each:

**Supabase Secrets:**
```
SUPABASE_URL = https://xxxxx.supabase.co
SUPABASE_ANON_KEY = eyJhbGc...
SUPABASE_SERVICE_KEY = eyJhbGc...
DATABASE_URL = postgresql://postgres:PASSWORD@db.xxxxx.supabase.co:5432/postgres
```

**Railway Secrets:**
```
RAILWAY_API_TOKEN = [Your Railway token]
RAILWAY_PROJECT_ID = [Found in Railway project settings]
RAILWAY_SERVICE_ID = [Found in Railway service settings]
```

**Vercel Secrets:**
```
VERCEL_TOKEN = [Your Vercel token]
VERCEL_ORG_ID = [Your org ID]
VERCEL_PROJECT_ID = [Will get after first deploy]
```

### Step 3.5: Verify Secrets
- [ ] Go to Repository → Settings → Secrets
- [ ] Confirm all 10 secrets are added (names should match exactly)

---

## Phase 4: Local Development Setup (30 minutes)

### Step 4.1: Create Environment Files

**Backend:**
```bash
cd backend
cp .env.example .env
```

Edit `backend/.env`:
```
NODE_ENV=development
PORT=3001
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_SERVICE_KEY=eyJhbGc...
DATABASE_URL=postgresql://postgres:PASSWORD@db.xxxxx.supabase.co:5432/postgres
```

**Frontend:**
```bash
cd frontend
cp .env.example .env.local
```

Edit `frontend/.env.local`:
```
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGc...
VITE_API_BASE_URL=http://localhost:3001
VITE_ENABLE_REALTIME=true
VITE_ENABLE_DEBUG=true
```

### Step 4.2: Update Backend Code
- [ ] Read `docs/BACKEND-CODE-MIGRATION.md` carefully
- [ ] Update `backend/src/index.js`:
  - [ ] Replace Google Sheets imports with Supabase
  - [ ] Add Supabase client initialization
  - [ ] Add connection test on startup
- [ ] Update all route files (`backend/src/routes/*.js`):
  - [ ] Replace API calls from Google Sheets to Supabase
  - [ ] Use patterns from migration guide
  - [ ] Test each endpoint as you go
- [ ] Update `backend/src/services/sheetsService.js`:
  - [ ] Either replace with supabaseService.js OR convert to use Supabase

**Estimated: 1-2 hours**

### Step 4.3: Update Frontend Code
- [ ] Read `docs/FRONTEND-CODE-MIGRATION.md` carefully
- [ ] Create `frontend/src/services/supabase.ts`:
  - [ ] Copy code from migration guide
  - [ ] Test connection with `testConnection()` function
- [ ] Update `frontend/src/services/api.ts`:
  - [ ] Replace axios calls with Supabase client calls
  - [ ] Keep same interface for compatibility
- [ ] Update `frontend/src/store/index.ts`:
  - [ ] Replace store logic to use Supabase
  - [ ] Add real-time subscriptions
- [ ] Update React components:
  - [ ] `src/components/Dashboard/Dashboard.tsx`
  - [ ] `src/components/Dashboard/ProjectModal.tsx`
  - [ ] `src/components/Table/TasksTab.tsx`
  - [ ] (and all other tabs similarly)

**Estimated: 1.5-2.5 hours**

### Step 4.4: Install Dependencies
```bash
# Backend
cd backend
npm install @supabase/supabase-js
npm install --save-dev dotenv

# Frontend
cd frontend
npm install @supabase/supabase-js
```

### Step 4.5: Test Locally
```bash
# Terminal 1 - Backend
cd backend
npm run dev
# Should show: ✅ Connected to Supabase

# Terminal 2 - Frontend
cd frontend
npm run dev
# Should show: Connected to http://localhost:3001

# Terminal 3 - Test API
curl http://localhost:3001/api/projects
# Should return JSON array (empty or with data)
```

---

## Phase 5: Data Migration (15-30 minutes)

Choose ONE of these options:

### Option A: CSV Import (Easiest - 5 minutes)
- [ ] Export from Google Sheets as CSV (.csv)
- [ ] In Supabase, go to Table Editor → projects
- [ ] Click "Import data" → Upload CSV
- [ ] Map columns: name, code, client, status, etc.
- [ ] Click Import
- [ ] Repeat for: tasks, members, milestones, efforts, issues, change_requests, risks

### Option B: Automated Script (Recommended - 15 minutes)
1. Create `scripts/migrate-from-sheets.js`:
```javascript
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const { google } = require('googleapis');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function migrateProjects() {
  // 1. Read from Google Sheets
  const sheetsAuth = new google.auth.GoogleAuth({
    keyFile: process.env.GOOGLE_APPLICATION_CREDENTIALS,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  
  const sheets = google.sheets({ version: 'v4', auth: sheetsAuth });
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: process.env.GOOGLE_SHEETS_SPREADSHEET_ID,
    range: 'Projects!A2:J100',
  });
  
  const rows = response.data.values || [];
  
  // 2. Transform to Supabase format
  const projects = rows.map(row => ({
    id: row[0],
    name: row[1],
    code: row[2],
    client: row[3],
    status: row[4],
    color: row[5],
    start_date: row[6],
    end_date: row[7],
    description: row[8],
  }));
  
  // 3. Insert into Supabase
  const { data, error } = await supabase
    .from('projects')
    .insert(projects);
  
  if (error) {
    console.error('Migration failed:', error);
  } else {
    console.log(`✅ Migrated ${projects.length} projects`);
  }
}

migrateProjects();
```

2. Run: `node scripts/migrate-from-sheets.js`
3. Repeat for all tables

### Option C: Manual SQL Insert (If small dataset - 30 minutes)
- [ ] In Google Sheets, copy data
- [ ] In Supabase SQL Editor, write INSERT statements:
```sql
INSERT INTO projects (id, name, code, client, status, color, start_date, end_date)
VALUES 
  ('uuid-1', 'Project Name', 'CODE', 'Client', 'In Progress', '#FF5733', '2024-01-01', '2024-12-31'),
  ('uuid-2', 'Project Name 2', 'CODE2', 'Client 2', 'Planning', '#33FF57', '2024-02-01', '2024-11-30');
```
- [ ] Execute queries
- [ ] Verify data in Table Editor

---

## Phase 6: Commit Changes (5 minutes)

```bash
# From project root
git add .
git commit -m "feat: Migrate from Google Sheets to Supabase with auto-deployment

- Add Supabase client library (@supabase/supabase-js)
- Create database schema with 10 tables
- Update backend to use Supabase queries instead of Google Sheets API
- Update frontend services and stores for Supabase
- Add GitHub Actions CI/CD workflows for Railway and Vercel
- Configure environment variables for development and production
- Migrate data from Google Sheets to PostgreSQL

Closes #deployment-setup"

git push origin main
```

---

## Phase 7: Monitor Deployments (5-10 minutes)

### Monitor Backend Deployment (Railway)
- [ ] Go to https://railway.app
- [ ] Select your project
- [ ] Click on backend service
- [ ] Watch deployment logs for:
  ```
  ✅ Connected to Supabase
  Server listening on port 3001
  ```
- [ ] Test API: `https://[railway-url]/api/projects`
- [ ] Should return JSON (empty array or data)

### Monitor Frontend Deployment (Vercel)
- [ ] Go to https://vercel.com
- [ ] Find your project
- [ ] Watch build logs for:
  ```
  ✅ Build successful
  ✅ Preview URL: https://[preview-url].vercel.app
  ✅ Production deployment: https://[domain].vercel.app
  ```
- [ ] Test frontend: Visit the URL
- [ ] Should load and connect to backend

### Check GitHub Actions
- [ ] Go to Repository → Actions
- [ ] See workflow runs for:
  - [ ] deploy-backend.yml ✅ (successful)
  - [ ] deploy-frontend.yml ✅ (successful)
- [ ] Click each to see logs

---

## Phase 8: Post-Deployment Testing (15 minutes)

### Frontend Tests
- [ ] Open browser to https://your-app.vercel.app
- [ ] Dashboard loads ✅
- [ ] See project list ✅
- [ ] Create new project ✅
- [ ] Edit existing project ✅
- [ ] Delete project ✅
- [ ] Switch to Tasks tab ✅
- [ ] Add new task ✅
- [ ] Try all other tabs (Members, Issues, etc.) ✅

### API Tests
```bash
# Test projects
curl -X GET https://[railway-url]/api/projects
curl -X POST https://[railway-url]/api/projects \
  -H "Content-Type: application/json" \
  -d '{"name":"Test","code":"TST","client":"Client","status":"Planning"}'

# Test tasks
curl -X GET https://[railway-url]/api/tasks?projectId=UUID
curl -X POST https://[railway-url]/api/tasks \
  -H "Content-Type: application/json" \
  -d '{"project_id":"UUID","name":"Task","assignee":"User","status":"To Do"}'
```

### Database Tests
In Supabase SQL Editor, run:
```sql
SELECT COUNT(*) FROM projects;
SELECT COUNT(*) FROM tasks;
SELECT COUNT(*) FROM members;
-- etc for all tables

-- Verify recent data
SELECT * FROM projects ORDER BY created_at DESC LIMIT 5;
```

---

## Phase 9: Cleanup & Optimization (Optional - 20 minutes)

### Remove Legacy Code
- [ ] Delete `backend/src/services/sheetsService.js` (if converted)
- [ ] Delete old Google Sheets API configuration files
- [ ] Remove Google Sheets credentials from `.env` files
- [ ] Delete `GOOGLE_APPLICATION_CREDENTIALS` from GitHub secrets
- [ ] Update `.gitignore` to exclude old config files

### Performance Optimization
- [ ] In Supabase, go to SQL Editor
- [ ] Add indexes for frequently queried columns:
```sql
CREATE INDEX idx_tasks_project_id ON tasks(project_id);
CREATE INDEX idx_tasks_assignee_id ON tasks(assignee_id);
CREATE INDEX idx_issues_project_id ON issues(project_id);
CREATE INDEX idx_change_requests_project_id ON change_requests(project_id);
```

### Setup Monitoring
- [ ] In Supabase Dashboard, check Usage metrics:
  - [ ] Database connections
  - [ ] Query performance
  - [ ] Storage used
- [ ] In Railway, setup alerts:
  - [ ] Failed deployments
  - [ ] High memory usage
  - [ ] Crash detection
- [ ] In Vercel, setup analytics:
  - [ ] Page performance
  - [ ] Error tracking
  - [ ] Core Web Vitals

---

## Quick Command Reference

```bash
# Setup
git clone https://github.com/YOUR-USERNAME/project-ms.git
cd project-ms
npm install

# Backend development
cd backend
cp .env.example .env
# Edit .env with Supabase credentials
npm install @supabase/supabase-js
npm run dev

# Frontend development
cd frontend
cp .env.example .env.local
# Edit .env.local with Supabase credentials
npm install @supabase/supabase-js
npm run dev

# Testing
curl http://localhost:3001/api/projects

# Deployment
git add .
git commit -m "message"
git push origin main
# GitHub Actions automatically triggers Railway & Vercel deployment

# Check logs
# Railway: https://railway.app → select project → view logs
# Vercel: https://vercel.com → select project → deployments
# GitHub: https://github.com → your repo → Actions
```

---

## Troubleshooting Quick Links

If you encounter issues, see:
1. **Connection Issues** → `docs/DEPLOY-GITHUB-RAILWAY-VERCEL.md` - Troubleshooting section
2. **Code Issues** → `docs/BACKEND-CODE-MIGRATION.md` or `docs/FRONTEND-CODE-MIGRATION.md`
3. **Deployment Issues** → Check GitHub Actions logs or Railway/Vercel dashboard logs

---

## Success Checklist (Mark each ✅)

- [ ] ✅ Supabase project created with 10 tables
- [ ] ✅ GitHub secrets configured (10 total)
- [ ] ✅ Workflows visible in `.github/workflows/`
- [ ] ✅ Backend updated with Supabase code
- [ ] ✅ Frontend updated with Supabase code
- [ ] ✅ Local development working (both `npm run dev`)
- [ ] ✅ Data migrated to Supabase
- [ ] ✅ Changes committed and pushed to main
- [ ] ✅ GitHub Actions workflows executed successfully
- [ ] ✅ Railway backend deployed and responding
- [ ] ✅ Vercel frontend deployed and accessible
- [ ] ✅ Frontend connects to backend API
- [ ] ✅ All CRUD operations working (Create, Read, Update, Delete)
- [ ] ✅ Real-time updates working (if implemented)
- [ ] ✅ No errors in browser console or server logs

### 🎉 All Done! Your System is Now Ready for Production

**What's next?**
1. Share deployment URL with team
2. Setup monitoring and alerts
3. Plan real-time features upgrade
4. Setup automated backups
5. Plan scaling strategy

