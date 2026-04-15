# 🚂 Railway Setup Guide - ภาษาไทย (ละเอียด!)

**Railway = Platform สำหรับ Deploy Backend อัตโนมัติ**

---

## 📌 Railway คืออะไร?

- ✅ ทำให้ Backend deploy อัตโนมัติเมื่อ push Git
- ✅ เชื่อมต่อกับ GitHub ได้เลย
- ✅ ฟรีได้ (freemium tier)
- ✅ เหมาะสำหรับ Node.js API

---

## ⏱️ ขั้นตอนที่ 1: สร้าง Railway Account (10 นาที)

### 1.1 สมัครสมาชิก

1. ไปที่ **https://railway.app**
2. กด **"Login"** (ด้านบนขวา)
3. เลือก **"GitHub"** เพื่อ Sign up
4. GitHub จะขอสิทธิ์ → กด **"Authorize railways"**
5. กลับมาที่ Railway → เสร็จ! ✅

### 1.2 ยืนยันว่าสำเร็จ

- ดู Dashboard: https://railway.app
- ควรเห็น "New Project" ปุ่ม

---

## ⏱️ ขั้นตอนที่ 2: สร้าง Railway Project (5 นาที)

### 2.1 สร้างโครงการใหม่

1. ไปที่ https://railway.app/dashboard
2. กด **"+ New Project"** (ปุ่มสีม่วง)
3. เลือก **"Create New Project"** → ตั้งชื่อ:
   ```
   ProjectMS Backend
   ```
4. กด **Create**

### 2.2 เลือก Template หรือ Git

หลังจากสร้าง:
- กด **"Deploy from Git"** (GitHub icon)
- เลือก GitHub repository: `your-username/project-ms`
- Railway จะถามสิทธิ์ GitHub → **Authorize** ✅

---

## ⏱️ ขั้นตอนที่ 3: ตั้งค่า Environment Variables ใน Railway (10 นาที)

### 3.1 ไปที่ Configuration

1. ใน Dashboard ของ Project
2. ดูด้านซ้าย → ควรเห็น **"project-ms"** service
3. กด **"project-ms"** → จะเห็น tabs
4. เลือก tab **"Variables"**

### 3.2 เพิ่ม Environment Variables

ต้องเพิ่ม 8 ตัวนี้ใน Railway Variables:

```
KEY                       VALUE
────────────────────────────────────────────────────
NODE_ENV                  production
PORT                      8080
SUPABASE_URL              https://xxxxx.supabase.co
SUPABASE_SERVICE_KEY      eyJhbGc...
SUPABASE_ANON_KEY         eyJhbGc...
DATABASE_URL              postgresql://postgres:PASSWORD@db.xxxxx.supabase.co:5432/postgres
FRONTEND_URL              https://[your-vercel-domain].vercel.app
CORS_ORIGIN               https://[your-vercel-domain].vercel.app
```

**หมายเหตุ:**
- `SUPABASE_*` = ดึงจาก Supabase ที่คุณสร้างไว้
- `DATABASE_URL` = สร้างจาก Supabase credentials
- `FRONTEND_URL` = เอาจาก Vercel (ไว้ก่อน ตั้งไว้แล้วสามารถเปลี่ยนได้)

### 3.3 วิธีเพิ่มอย่างละเอียด

1. อยู่ใน **Variables** tab
2. ติดกับช่อง **"KEY"**
3. พิมพ์: `NODE_ENV`
4. ติด **"VALUE"** ด้านขวา
5. พิมพ์: `production`
6. กด **Enter** หรือ **Add**
7. ปรากฏใน List ด้านล่าง
8. **ทำซ้ำ** สำหรับ 7 variables อื่นๆ

---

## ⏱️ ขั้นตอนที่ 4: สร้าง API Token (5 นาที)

### 4.1 ไปที่ Account Settings

1. ด้านกลับขวา Railway Dashboard
2. กด **Profile Icon** (รูป avatar)
3. เลือก **"Account"**

### 4.2 สร้าง New Token

1. ไปที่ tab **"Tokens"**
2. ควรเห็น **"Create New Token"** ปุ่ม
3. กด มัน
4. ตั้งชื่อ:
   ```
   GitHub Actions Deploy
   ```
5. กด **"Create Token"**
6. **⚠️ สำคัญ!** Copy token ทั้งหมดออกมา:
   ```
   railway_xxxxxxxxxxxxx...
   ```
7. เก็บไว้ (จะใช้หน้าต่อไป)

---

## ⏱️ ขั้นตอนที่ 5: ตั้ง GitHub Secret (5 นาที)

### 5.1 ไปที่ GitHub Repository

1. https://github.com/[your-username]/project-ms
2. ไปที่ **Settings** → **Secrets and variables** → **Actions**

### 5.2 เพิ่ม Secret ใหม่

1. กด **"New repository secret"**
2. ชื่อ: `RAILWAY_TOKEN`
3. ค่า: Paste token ที่ copy ไว้
4. กด **Add secret**

ยังต้องเพิ่ม 2 ตัวอีก:

#### **RAILWAY_PROJECT_ID**
1. ไปกลับ Railway Dashboard
2. ดูที่ URL:
   ```
   https://railway.app/project/[THIS-IS-PROJECT-ID]
   ```
3. Copy `[THIS-IS-PROJECT-ID]`
4. GitHub Secret → ชื่อ: `RAILWAY_PROJECT_ID`, ค่า: paste มัน

#### **RAILWAY_SERVICE_ID** (ถ้าต้อง)
ปกติไม่ต้อง แต่ถ้าต้อง:
1. Railway Dashboard → project-ms service
2. Settings tab
3. ดู Service ID ที่ด้านบน

---

## ⏱️ ขั้นตอนที่ 6: ทดสอบ Deploy (10 นาที)

### 6.1 Trigger Deployment

วิธี A: ผ่าน GitHub (อัตโนมัติ)
```bash
git add .
git commit -m "test: trigger railway deployment"
git push origin main
```

จากนั้น:
1. ไปที่ GitHub Actions
2. ดู workflow `deploy-backend.yml` ทำงาน
3. ปกติใช้เวลา 2-3 นาที

วิธี B: ไปที่ Railway trigger manually
1. Railway Dashboard → project-ms
2. gps ด้านบนสุด "Deploy" ปุ่ม
3. เลือก branch `main`
4. รอให้ deploy เสร็จ

### 6.2 ตรวจสอบ Deploy สำเร็จ

1. Railway Dashboard → project-ms
2. ดู **"Deployments"** tab
3. ควรเห็น Status: **Success** ✅
4. ดูข้างล่าง → "Logs" ควรเห็น:
   ```
   ✅ Connected to Supabase
   🚀 ProjectMS API on http://localhost:8080
   ```

### 6.3 เข้าใจ Error (ถ้ามี)

❌ **"Cannot find module"**
- ต้อง `npm install` ใน backend
- ตรวจ package.json

❌ **"Port already in use"**
- Railway port อาจต่าง (มักจะ 8080)
- ตรวจ PORT ใน Environment Variables

❌ **"Supabase connection failed"**
- ตรวจ SUPABASE_* variables ใน Railway
- ตรวจ credentials เป็น text ตรงไหม

---

## ⏱️ ขั้นตอนที่ 7: ดู Public URL (5 นาที)

### 7.1 หาเว็บไซต์

1. Railway Dashboard → project-ms service
2. ด้านขวา → ควรเห็น "Generate Domain" หรือมี URL อยู่แล้ว
3. หน้าตา:
   ```
   https://projectms-backend-production.up.railway.app
   ```

### 7.2 ทดสอบ API

```bash
# ลองสั่ง curl
curl https://projectms-backend-production.up.railway.app/api/projects

# ควรได้ JSON:
# {"success": true, "data": [...]}
```

หรือใช้เบราว์เซอร์:
```
https://projectms-backend-production.up.railway.app/health
```

ควรเห็น:
```json
{
  "status": "OK",
  "message": "Server is running",
  "ts": "2026-04-14T10:30:00Z"
}
```

---

## ⏱️ ขั้นตอนที่ 8: เชื่อมต่อ Frontend (5 นาที)

### 8.1 อัพเดต Vercel Environment

เมื่อมี Railway URL สำเร็จ:

1. ไปที่ Vercel Dashboard → project-ms-frontend
2. Settings → Environment Variables
3. หา `VITE_API_BASE_URL`
4. เปลี่ยนค่าจาก:
   ```
   http://localhost:3001
   ```
   เป็น:
   ```
   https://projectms-backend-production.up.railway.app
   ```
5. บันทึก (Save)

### 8.2 Deploy Frontend อีกรอบ

1. Vercel จะ auto-deploy หลังจากเปลี่ยน env vars
2. หรือ ไปหา "Deployments" → กด "Redeploy"

---

## 🎯 GitHub Actions Workflow ที่เตรียมไว้

File: `.github/workflows/deploy-backend.yml`

```yaml
# ทำการ:
# 1. ตรวจสอบ code (lint, test)
# 2. Build application
# 3. Deploy ไป Railway อัตโนมัติ
# 4. ทำงานที่ทุก push ไปยัง main branch

# ใช้ secrets:
# - RAILWAY_TOKEN
# - SUPABASE_URL
# - เป็นต้น
```

**ผู้ใช้ไม่ต้องทำ** - มันทึ่อง Git ไว้แล้ว ✅

---

## 📊 สรุป Variables ที่ต้องเพิ่ม 3 ที่

### ที่ Railway (Deployments)
```
NODE_ENV                 = production
PORT                     = 8080
SUPABASE_URL            = https://xxxxx.supabase.co
SUPABASE_SERVICE_KEY    = eyJhbGc...
SUPABASE_ANON_KEY       = eyJhbGc...
DATABASE_URL            = postgresql://postgres:PASSWORD@...
FRONTEND_URL            = https://your-vercel-domain.vercel.app
CORS_ORIGIN             = https://your-vercel-domain.vercel.app
```

### ที่ GitHub Secrets
```
RAILWAY_TOKEN           = railway_xxxxx...
RAILWAY_PROJECT_ID      = [project-id]
```

### ที่ Vercel (Frontend Env Vars)
```
VITE_API_BASE_URL       = https://projectms-backend-production.up.railway.app
VITE_SUPABASE_URL       = https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY  = eyJhbGc...
```

---

## ✅ Checklist Railway Setup

- [ ] ✅ บัญชี Railway สร้างแล้ว
- [ ] ✅ GitHub authorize สำเร็จ
- [ ] ✅ โครงการ "ProjectMS Backend" สร้างแล้ว
- [ ] ✅ GitHub repo เชื่อมต่อแล้ว
- [ ] ✅ 8 Environment Variables เพิ่มแล้ว
- [ ] ✅ API Token สร้างแล้ว
- [ ] ✅ GitHub Secret `RAILWAY_TOKEN` เพิ่มแล้ว
- [ ] ✅ GitHub Secret `RAILWAY_PROJECT_ID` เพิ่มแล้ว
- [ ] ✅ Deploy สำเร็จ (Status: Success)
- [ ] ✅ Public URL ทำงานแล้ว (health check)
- [ ] ✅ เชื่อมต่อ Frontend แล้ว

---

## 🆘 Troubleshooting Railway

| ปัญหา | วิธีแก้ |
|---|---|
| ❌ "Unauthorized" | ตรวจ RAILWAY_TOKEN ว่า valid |
| ❌ Build failed | ดู Logs → ปกติ npm dependency สาหัว |
| ❌ "Port already in use" | Railway auto port อื่น แต่ env ต่อ PORT อาจต่าง |
| ❌ Supabase connection fail | ตรวจ SUPABASE_URL ใน Railway Env Vars |
| ❌ CORS error | ตรวจ FRONTEND_URL + CORS_ORIGIN ใน Railway |
| ❌ ช้า/Timeout | ตรวจ Supabase connection + database |

---

## 🎯 Timeline ทั้งหมด

```
ขั้นตอน                      เวลา
─────────────────────────────────
1. สร้าง Account            10 นาที
2. สร้าง Project            5 นาที
3. Environment Vars         10 นาที
4. สร้าง Token              5 นาที
5. GitHub Secret            5 นาที
6. ทดสอบ Deploy             10 นาที
7. ดู Public URL            5 นาที
8. เชื่อมต่อ Frontend       5 นาที
─────────────────────────────────
TOTAL:                       55 นาที
```

---

## 🎉 เสร็จแล้ว!

เมื่อ Setup Railway เสร็จ:
- ✅ Backend ปล่อยผ่าน Railway
- ✅ Auto-deploy ทุกครั้ง push Git
- ✅ เชื่อมต่อกับ Frontend ได้
- ✅ เข้าถึงผ่าน public URL ได้

**ต่อไป → ตั้ง Vercel (Frontend) หรือข้ามไปใช้งานได้เลย!**

