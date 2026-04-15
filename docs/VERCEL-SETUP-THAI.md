# 🚀 Vercel Setup Guide - ภาษาไทย (ละเอียด!)

**Vercel = Platform สำหรับ Deploy Frontend อัตโนมัติ**

---

## 📌 Vercel คืออะไร?

- ✅ ทำให้ Frontend deploy อัตโนมัติเมื่อ push Git
- ✅ เชื่อมต่อกับ GitHub ได้เลย
- ✅ **ฟรีมาก** (free tier ดี)
- ✅ เหมาะสำหรับ React + TypeScript
- ✅ Global CDN (เร็วสุดโลก)

---

## ⏱️ ขั้นตอนที่ 1: สร้าง Vercel Account (10 นาที)

### 1.1 สมัครสมาชิก

1. ไปที่ **https://vercel.com**
2. กด **"Sign Up"** (ด้านบนขวา)
3. เลือก **"GitHub"** เพื่อ Sign up
4. GitHub จะขอสิทธิ์ → กด **"Authorize Vercel"**
5. Vercel จะขอ email ยืนยัน (ดู email + verify)
6. กลับมาที่ Vercel Dashboard → เสร็จ! ✅

### 1.2 ยืนยันว่าสำเร็จ

- ดู Dashboard: https://vercel.com/dashboard
- ควรเห็น "Add New..." ปุ่ม

---

## ⏱️ ขั้นตอนที่ 2: Import GitHub Repository (10 นาที)

### 2.1 ไปที่ Vercel Dashboard

1. https://vercel.com/dashboard
2. กด **"Add New..."** (ปุ่มใหญ่สีขาวด้านบน)
3. เลือก **"Project"**

### 2.2 Import GitHub Repo

1. ควรเห็น GitHub repositories list
2. หา **"project-ms"** ในรายการ
3. (ถ้าไม่เห็น กด "Import Git Repository" link)
4. กด **"Import"** ปุ่ม

### 2.3 ตั้งค่า Project

เมื่อ Import เสร็จ:

1. **Project Name**: เปลี่ยนเป็น
   ```
   project-ms-frontend
   ```

2. **Root Directory**: เลือก
   ```
   frontend/
   ```
   (ส่วนหลัก Vercel เค้า auto-detect ได้)

3. **Framework Preset**: ควร auto-detect เป็น
   ```
   Vite
   ```

4. กด **"Deploy"** ปุ่มสีน้ำเงิน

---

## ⏱️ ขั้นตอนที่ 3: ตั้งค่า Build & Deploy Settings (5 นาที)

### 3.1 ตรวจสอบ Build Command

ปกติ Vercel auto-detect แล้ว:

```
Build Command:     npm run build
Output Directory:  dist
Install Command:   npm install
```

✅ ปล่อยไว้อย่างนี้ได้

### 3.2 Environment Variables

1. ปกติ Vercel จะถามเก็บไว้
2. หรือ ไปที่ Project Settings → Environment Variables

---

## ⏱️ ขั้นตอนที่ 4: เพิ่ม Environment Variables ใน Vercel (10 นาที)

### 4.1 ไปที่ Settings

1. Vercel Dashboard → project-ms-frontend
2. กด **"Settings"** tab
3. ไปที่ **"Environment Variables"** (ด้านซ้าย)

### 4.2 เลือก Environment

ด้านบนสุด, ควรเห็น 3 options:
```
☐ Production
☐ Preview
☐ Development
```

✅ เพิ่ม**ทั้ง Production + Preview** (Development ไม่ต้อง)

### 4.3 เพิ่ม Variables

ต้องเพิ่ม 3 ตัวนี้:

#### **1. VITE_SUPABASE_URL**

```
Name:               VITE_SUPABASE_URL
Value:              https://xxxxx.supabase.co
Environments:       ☑ Production, ☑ Preview
```

ที่มา: Supabase Settings → API

#### **2. VITE_SUPABASE_ANON_KEY**

```
Name:               VITE_SUPABASE_ANON_KEY
Value:              eyJhbGc...
Environments:       ☑ Production, ☑ Preview
```

ที่มา: Supabase Settings → API (anon key)

#### **3. VITE_API_BASE_URL**

```
Name:               VITE_API_BASE_URL
Value:              https://projectms-backend-production.up.railway.app
Environments:       ☑ Production, ☑ Preview
```

ที่มา: Railway public URL (จากตั้ง Railway ก่อน)

**⚠️ หมายเหตุ:** ถ้า Railway ยังไม่เสร็จ ให้ใส่:
```
http://localhost:3001
```
แล้วแก้ไขทีหลังเมื่อได้ Railway URL

### 4.4 วิธีเพิ่มอย่างละเอียด

1. **"Name"** input → พิมพ์ชื่อ (เช่น `VITE_SUPABASE_URL`)
2. **"Value"** input → พิมพ์ค่า (เช่น `https://xxxxx.supabase.co`)
3. เลือก **Environments**: ติ๊ก ✓ Production + Preview
4. กด **"Save"** ปุ่ม
5. ตัว env var จะบันทึก ✅
6. ทำซ้ำสำหรับ 2 ตัวอื่นๆ

### 4.5 ตรวจสอบ Variables

สุดท้าย ควรเห็นใน Environment Variables list:
```
✓ VITE_SUPABASE_URL              (Prod, Prev)
✓ VITE_SUPABASE_ANON_KEY         (Prod, Prev)
✓ VITE_API_BASE_URL              (Prod, Prev)
```

---

## ⏱️ ขั้นตอนที่ 5: ทดสอบ Deploy (10 นาที)

### 5.1 Trigger Deployment

หลังจาก set environment variables:

1. Vercel **auto-redeploy** เลย
2. หรือ ไปที่ **"Deployments"** tab
3. กด **"Redeploy"** ปุ่มสีขาว

### 5.2 ดูการ Deploy

1. **"Deployments"** tab
2. เห็น deployment listing
3. ค้นหา commit ล่าสุด
4. Status ควร:
   ```
   ✓ Building...  →  ✓ Ready
   ```
   (ใช้เวลา 2-3 นาที)

### 5.3 ตรวจสอบ Build Logs (ถ้ามี Error)

1. กด deployment ที่ล่าสุด
2. **"Logs"** tab
3. ดู build output
4. ถ้า fail ดูข้อความ error

---

## ⏱️ ขั้นตอนที่ 6: ดู Public URL (5 นาที)

### 6.1 หา Domain

1. Vercel Dashboard → project-ms-frontend
2. ด้านบนสุด ควรเห็น URL:
   ```
   https://project-ms-frontend.vercel.app
   ```

3. หรือ custom domain (ได้เพิ่มเอง)

### 6.2 ทดสอบเว็บ

1. เปิด https://project-ms-frontend.vercel.app
2. ควรเห็น Dashboard
3. ลองกด Create Project
4. ถ้าทำงานได้ = สำเร็จ ✅

---

## ⏱️ ขั้นตอนที่ 7: เชื่อมต่อ Backend (5 นาที)

### 7.1 หลังจากมี Railway URL

เมื่อ setup Railway เสร็จ ได้ URL เช่น:
```
https://projectms-backend-production.up.railway.app
```

### 7.2 อัพเดต Frontend Env Var

ไปที่ Vercel:
1. Settings → Environment Variables
2. แก้ `VITE_API_BASE_URL`
3. เปลี่ยนจาก `http://localhost:3001`
4. เป็น Railway URL
5. บันทึก (Save)

### 7.3 Redeploy

1. ไปที่ **"Deployments"**
2. กด **"Redeploy"** ล่าสุด
3. รอให้ build เสร็จ
4. ลองใช้เว็บใหม่

---

## ⏱️ ขั้นตอนที่ 8: GitHub Actions สำหรับ Frontend (Optional)

File: `.github/workflows/deploy-frontend.yml` (เตรียมไว้แล้ว ✅)

ขั้นตอน:
1. ทุกครั้ง push ไป `main` branch
2. GitHub Actions รัน build
3. Deploy ไป Vercel อัตโนมัติ

**ผู้ใช้ไม่ต้องทำ** - ตั้งไว้แล้ว!

---

## 📊 สรุป Variables ทั้งหมด

### ที่ Vercel Environment Variables
```
VITE_SUPABASE_URL           = https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY      = eyJhbGc...
VITE_API_BASE_URL           = https://projectms-backend-production.up.railway.app
```

**ตั้งแต่ด้วย Environments: ✓ Production + Preview**

---

## ✅ Checklist Vercel Setup

- [ ] ✅ บัญชี Vercel สร้างแล้ว
- [ ] ✅ GitHub authorize สำเร็จ
- [ ] ✅ Import GitHub repo (project-ms)
- [ ] ✅ เลือก Root Directory: `frontend/`
- [ ] ✅ Deploy ครั้งแรกสำเร็จ
- [ ] ✅ 3 Environment Variables เพิ่มแล้ว
- [ ] ✅ Build เสร็จ (Status: Ready)
- [ ] ✅ Public URL ทำงาน (เห็น Dashboard)
- [ ] ✅ เชื่อมต่อ Backend แล้ว (ทดลอง create project)

---

## 🆘 Troubleshooting Vercel

| ปัญหา | วิธีแก้ |
|---|---|
| ❌ "Build failed" | ดู Logs → ปกติ npm / TypeScript issue |
| ❌ Blank white page | Check browser console → ดู error message |
| ❌ API connection fail | ตรวจ VITE_API_BASE_URL ถูกต้องหรือไม่ |
| ❌ "Cannot GET /" | frontend build อาจ fail → ดู logs |
| ❌ CORS error | ตรวจ Backend CORS_ORIGIN ตรงกับ Vercel URL |
| ❌ Env vars ไม่มี effect | Deploy ใหม่ (Redeploy) ต้องทำ |

---

## 🎯 Timeline ทั้งหมด

```
ขั้นตอน                      เวลา
─────────────────────────────────
1. สร้าง Account            10 นาที
2. Import GitHub Repo       10 นาที
3. Build Settings           5 นาที
4. Environment Variables    10 นาที
5. ทดสอบ Deploy             10 นาที
6. ดู Public URL            5 นาที
7. เชื่อมต่อ Backend        5 นาที
8. GitHub Actions (optional) 0 นาที
─────────────────────────────────
TOTAL:                      55 นาที
```

---

## 🎉 เสร็จแล้ว!

เมื่อ Setup Vercel เสร็จ:
- ✅ Frontend ปล่อยผ่าน Vercel
- ✅ Auto-deploy ทุกครั้ง push Git
- ✅ เชื่อมต่อกับ Backend ได้
- ✅ เข้าถึงผ่าน public URL ได้

**ต่อไป → ทดสอบการทำงานทั้งระบบ!**

---

## 🔗 Links สำคัญ

| สิ่ง | Link |
|---|---|
| Vercel Dashboard | https://vercel.com/dashboard |
| Project Frontend | https://vercel.com/dashboard/[your-project] |
| Public URL | https://project-ms-frontend.vercel.app |
| Settings | https://vercel.com/dashboard/[your-project]/settings |
| Deployments | https://vercel.com/dashboard/[your-project]/deployments |

---

## ✨ Bonus: Custom Domain (Optional)

ถ้าต้องการเปลี่ยนจาก `vercel.app` เป็น domain ของคุณ:

1. Vercel Settings → Domains
2. เพิ่ม domain
3. ตั้งค่า DNS
4. (วิธีละเอียด → ถามหลังเลย)

