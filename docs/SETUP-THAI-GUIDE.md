# 📋 คู่มือการตั้งค่า Supabase + Auto Deploy - ภาษาไทย

**ระยะเวลารวม: 2-3 ชั่วโมง**

---

## ⏱️ ขั้นตอนที่ 1: สร้าง Supabase Account (15 นาที)

### 1.1 สร้างโครงการ Supabase

1. ไปที่ https://supabase.com
2. กด **"Start your project"** → **"Sign up with GitHub"**
3. ให้สิทธิ์เข้าถึง GitHub repository
4. กำหนดค่าโครงการ:
   - **Project Name**: `project-ms`
   - **Region**: เลือกที่ใกล้กับคุณมากที่สุด (e.g., Bangkok, Singapore, Tokyo)
   - **Database Password**: สร้างรหัสผ่านที่แข็งแรง (บันทึกไว้!)

5. รอ 2-3 นาทีให้ฐานข้อมูลพร้อมใช้งาน

### 1.2 รับ Credentials

1. เข้า Dashboard → Settings → API
2. บันทึกข้อมูลต่อไปนี้ (จะต้องใช้ให้ได้):

```
📌 SUPABASE_URL
→ หน้าตา: https://xxxxx.supabase.co

📌 SUPABASE_ANON_KEY  
→ ล่วงหน้าด้วย eyJ...

📌 SUPABASE_SERVICE_KEY
→ ล่วงหน้าด้วย eyJ... (key ที่ยาวกว่า)

📌 DATABASE_PASSWORD
→ รหัสผ่านที่คุณสร้างไว้
```

---

## ⏱️ ขั้นตอนที่ 2: สร้างตารางในฐานข้อมูล (5 นาที)

### 2.1 เรียก SQL Schema

1. เข้า Supabase Dashboard
2. ไปที่ **SQL Editor** (ด้านซ้าย)
3. กด **New Query**
4. Copy-paste โค้ดทั้งหมดจาก: `docs/supabase-schema.sql`
5. กด **RUN** (ปุ่มสีฟ้า)
6. รอให้เสร็จ → เห็นข้อความ "success"

### 2.2 ตรวจสอบ

1. ไปที่ **Table Editor** (ด้านซ้าย)
2. ควรเห็นตาราง 11 ตัว:
   - `projects`, `tasks`, `members`, `milestones`
   - `efforts`, `issues`, `change_requests`, `risks`
   - `users`, `audit_log`, `change_request_items`

✅ ถ้าเห็นหมด = สำเร็จ!

---

## ⏱️ ขั้นตอนที่ 3: ตั้งค่า GitHub Secrets (10 นาที)

### 3.1 เข้า GitHub Settings

1. ไปที่ Repository ของคุณบน GitHub
2. **Settings** → **Secrets and variables** → **Actions**
3. กด **New repository secret**

### 3.2 เพิ่ม Secrets ทั้งหมด

ต้องเพิ่ม **อย่างน้อย 4 Secret** ก่อน (ส่วน Railway/Vercel ทำทีหลังได้):

#### **ความสำคัญสูง - ต้องเพิ่มเลย:**

| Secret Name | ค่า | ที่มา |
|---|---|---|
| `SUPABASE_URL` | `https://xxxxx.supabase.co` | Supabase Settings → API |
| `SUPABASE_ANON_KEY` | `eyJhbGc...` | Supabase Settings → API (ค่า `anon` key) |
| `SUPABASE_SERVICE_KEY` | `eyJhbGc...` | Supabase Settings → API (ค่า `service_role` key) |
| `DATABASE_URL` | `postgresql://postgres:PASSWORD@db.xxxxx.supabase.co:5432/postgres` | สร้างจากข้อมูล Supabase |

**วิธีสร้าง DATABASE_URL:**
```
postgresql://postgres:[PASSWORD]@db.[PROJECT_ID].supabase.co:5432/postgres
```
แทนที่:
- `[PASSWORD]` = รหัสที่คุณสร้างมา
- `[PROJECT_ID]` = ส่วนแรกของ SUPABASE_URL (เช่น `abc123def`)

#### **สำหรับ Railway (ทำแยกหน้า: RAILWAY-SETUP-THAI.md):**
👉 **[ดูรายละเอียดเต็ม: docs/RAILWAY-SETUP-THAI.md](RAILWAY-SETUP-THAI.md)**

#### **สำหรับ Vercel (ทำแยกหน้า: VERCEL-SETUP-THAI.md):**
👉 **[ดูรายละเอียดเต็ม: docs/VERCEL-SETUP-THAI.md](VERCEL-SETUP-THAI.md)**

### 3.3 ตรวจการตั้งค่า

1. ไปที่ Repository **Settings** → **Secrets**
2. ควรเห็นอย่างน้อย 4 Secret (ถ้ายังไม่ตั้ง Railway/Vercel)
3. ตัวหนังสือแต่ละอันต้องตรงกับตารางข้างบน

---

## ⏱️ ขั้นตอนที่ 4: เตรียม Environment Files (5 นาที)

### 4.1 Backend Environment

```bash
cd backend
cp .env.example .env
```

แล้วแก้ไข `backend/.env` ให้เป็น:

```env
NODE_ENV=development
PORT=3001
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_KEY=eyJhbGc...
SUPABASE_ANON_KEY=eyJhbGc...
DATABASE_URL=postgresql://postgres:PASSWORD@db.xxxxx.supabase.co:5432/postgres
FRONTEND_URL=http://localhost:5173
CORS_ORIGIN=http://localhost:5173
ENABLE_REALTIME=true
```

### 4.2 Frontend Environment

```bash
cd frontend
cp .env.example .env.local
```

แล้วแก้ไข `frontend/.env.local` ให้เป็น:

```env
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGc...
VITE_API_BASE_URL=http://localhost:3001
VITE_ENABLE_REALTIME=true
VITE_ENABLE_DEBUG=true
```

---

## ⏱️ ขั้นตอนที่ 5: ติดตั้ง Dependencies (5 นาที)

```bash
# Backend
cd backend
npm install

# Frontend
cd frontend
npm install
```

---

## ⏱️ ขั้นตอนที่ 6: ทดสอบ Local Development (20 นาที)

### 6.1 เรียก Backend

เปิด Terminal 1:
```bash
cd backend
npm run dev
```

ควรเห็น:
```
✅ Connected to Supabase
🚀 ProjectMS API on http://localhost:3001
```

### 6.2 เรียก Frontend

เปิด Terminal 2:
```bash
cd frontend
npm run dev
```

บรรทัดสุดท้ายจะมี URL เช่น:
```
http://localhost:5173
```

### 6.3 ทดสอบเว็บ

1. เปิด http://localhost:5173 ในเบราว์เซอร์
2. ควรเห็น Dashboard
3. กด Create Project → ลองสร้างโครงการใหม่
4. ถ้าสาเร็จ = ทำได้ถูกต้อง ✅

---

## 🎯 (Optional) ขั้นตอน Railway + Vercel สำหรับ Production Deploy

ถ้า**ไม่ต้องใช้ Cloud Deploy** (local ได้) → ข้ามได้

ถ้า**ต้อง Deploy ขึ้นเว็บ** (ผู้คนเข้าถึงได้จากทั่วโลก):

### สำหรับ Backend (Node.js API):
👉 **[ดูคู่มือ: docs/RAILWAY-SETUP-THAI.md](RAILWAY-SETUP-THAI.md)**
- สร้าง Railway account
- เชื่อมต่อ GitHub
- ตั้ง Environment Variables
- Deploy อัตโนมัติ

### สำหรับ Frontend (React):
👉 **[ดูคู่มือ: docs/VERCEL-SETUP-THAI.md](VERCEL-SETUP-THAI.md)**
- สร้าง Vercel account
- Import GitHub repo
- ตั้ง Environment Variables
- Deploy อัตโนมัติ

---

## ⏱️ ขั้นตอนที่ 7: ย้ายข้อมูล Google Sheets → Supabase (15 นาที)

### ตัวเลือก A: Export CSV (ง่ายสุด)

1. เปิด Google Sheet ของคุณ
2. Sheet → Download → CSV (.csv)
3. เข้า Supabase → Table Editor
4. เลือกตาราง → Import data
5. Upload CSV file
6. Map columns ให้ถูก → Import

**ทำซ้ำสำหรับ:**
- Projects
- Tasks  
- Members
- Milestones
- Issues
- Change Requests
- Risks

### ตัวเลือก B: SQL Script (มีประสิทธิภาพสูง)

1. ให้้ฉันสร้าง script ให้ถ้าต้องการ
2. Copy ข้อมูลจาก Google Sheet
3. Paste เป็น SQL INSERT

---

## ⏱️ ขั้นตอนที่ 8: อัพโหลด Git (5 นาที)

```bash
# ใจกลาง project root
git add .
git commit -m "feat: Migrate Google Sheets → Supabase

- Add Supabase client configuration
- Add environment variable templates
- Update backend/routes to use supabaseService
- Add frontend Supabase integration
- Full schema with 11 tables"

git push origin main
```

GitHub Actions จะทำงานอัตโนมัติถ้าตั้ง CI/CD workflows

---

## ⏱️ ขั้นตอนที่ 9: ตรวจสอบข้อมูล (10 นาที)

### ที่ Supabase:

1. Table Editor → projects
2. ควรเห็นข้อมูล (ถ้ายังไม่มีก็ว่างไป)
3. ลองสร้างโครงการใหม่จากเว็บ
4. ตรวจสอบเห็นใน Table Editor ไหม

### ที่ Terminal:

```bash
# โปรแกรม curl ทดสอบ API
curl http://localhost:3001/api/projects

# ควรได้ JSON array
# [{"id": "...", "name": "...", ...}]
```

---

## 🎯 Quick Troubleshooting

| ปัญหา | วิธีแก้ |
|---|---|
| `❌ Connected to Supabase` | ตรวจ URL และ API keys ใน .env |
| `404 not found` | ตรวจว่า backend running ที่ port 3001 |
| `CORS error` | ตรวจ CORS_ORIGIN ใน backend .env |
| `Table not found` | รัน SQL schema ใหม่ใน Supabase |
| `Connection refused` | ตรวจ Supabase project ว่า active |

---

## ✅ Checklist สำเร็จ

- [ ] ✅ สร้าง Supabase account
- [ ] ✅ เรียก SQL schema
- [ ] ✅ เพิ่ม GitHub Secrets (อย่างน้อย 4 ตัว)
- [ ] ✅ สร้าง .env files (backend + frontend)
- [ ] ✅ ติดตั้ง npm dependencies
- [ ] ✅ ทดสอบ backend (`npm run dev`)
- [ ] ✅ ทดสอบ frontend (`npm run dev`)
- [ ] ✅ ยืนยันเว็บแสดง localhost:5173
- [ ] ✅ ทดสอบสร้างโครงการใหม่
- [ ] ✅ อัพโหลด GitHub (`git push`)

---

## 📞 ติดต่อเมื่อต้องการความช่วยเหลือ

- ❌ ติดปัญหา → ให้ดู Troubleshooting ด้านบน
- ❓ คำถาม → ถามใน comment หรือ issue
- 🐛 Bug → Report ใน GitHub Issues

**ขอให้สำเร็จ! 🎉**

