# คู่มือ Deploy Production + ดึงโค้ดลงเครื่อง (Step-by-Step)

## สำหรับ macOS + VS Code — เขียนสำหรับมือใหม่

---

## สารบัญ

1. [สถานการณ์ปัจจุบัน](#สถานการณ์ปัจจุบัน)
2. [ขั้นตอนที่ 1 — ดึงโค้ดล่าสุดลงเครื่อง](#ขั้นตอนที่-1--ดึงโค้ดล่าสุดลงเครื่อง)
3. [ขั้นตอนที่ 2 — ตั้งค่า Supabase (ถ้ายังไม่ได้ทำ)](#ขั้นตอนที่-2--ตั้งค่า-supabase-ถ้ายังไม่ได้ทำ)
4. [ขั้นตอนที่ 3 — ตั้งค่า Environment Variables บนเครื่อง](#ขั้นตอนที่-3--ตั้งค่า-environment-variables-บนเครื่อง)
5. [ขั้นตอนที่ 4 — ทดสอบรันบนเครื่อง (Local)](#ขั้นตอนที่-4--ทดสอบรันบนเครื่อง-local)
6. [ขั้นตอนที่ 5 — Deploy Production บน Vercel](#ขั้นตอนที่-5--deploy-production-บน-vercel)
7. [ขั้นตอนที่ 6 — ตั้งค่า Supabase ให้รองรับ Production URL](#ขั้นตอนที่-6--ตั้งค่า-supabase-ให้รองรับ-production-url)
8. [ขั้นตอนที่ 7 — ตั้งค่า Production สำหรับใช้งานจริง](#ขั้นตอนที่-7--ตั้งค่า-production-สำหรับใช้งานจริง)
9. [ขั้นตอนที่ 8 — ทดสอบ Production](#ขั้นตอนที่-8--ทดสอบ-production)
10. [การอัปเดตโค้ดในอนาคต](#การอัปเดตโค้ดในอนาคต)
11. [การแก้ปัญหาที่พบบ่อย](#การแก้ปัญหาที่พบบ่อย)

---

## สถานการณ์ปัจจุบัน

| สิ่งที่มีอยู่แล้ว | สถานะ |
|---|---|
| Repo `project-ms` บน GitHub | มีแล้ว — โค้ดล่าสุด (PR #3, #6, #7 merged) อยู่ใน `main` |
| Vercel project `project-ms` | มีแล้ว — แต่อาจยังไม่ได้ตั้ง env vars หรือยังใช้โค้ดเก่า |
| Supabase project | อาจมีหรือยังไม่มี |
| โค้ดในเครื่อง Mac | มี `project-ms` อยู่แล้ว แต่อาจเป็นเวอร์ชันเก่า |

### สิ่งที่ต้องทำ

```
┌─────────────────────────────────────────────────────────┐
│  1. ดึงโค้ดล่าสุดจาก GitHub ลงเครื่อง (git pull)        │
│  2. ตั้งค่า Supabase (ถ้ายังไม่ได้ทำ)                    │
│  3. สร้างไฟล์ .env.local บนเครื่อง                       │
│  4. ทดสอบรันบนเครื่องว่าใช้งานได้                         │
│  5. Deploy ขึ้น Vercel (Production)                      │
│  6. ตั้งค่า URL ใน Supabase                              │
│  7. ตั้งค่า Production (เปิด Email Confirm, etc.)         │
│  8. ทดสอบ Production                                     │
└─────────────────────────────────────────────────────────┘
```

### สิ่งที่ต้องเตรียม

| สิ่งที่ต้องมี | ตรวจสอบ |
|---|---|
| **Node.js 18+** | เปิด Terminal พิมพ์ `node -v` ต้องเห็น `v18.x.x` ขึ้นไป |
| **Git** | เปิด Terminal พิมพ์ `git --version` ต้องเห็นเลขเวอร์ชัน |
| **VS Code** | เปิดได้จาก Dock หรือ Launchpad |
| **บัญชี Supabase** | สมัครฟรีที่ [supabase.com](https://supabase.com) |
| **บัญชี Vercel** | สมัครฟรีที่ [vercel.com](https://vercel.com) (แนะนำ login ด้วย GitHub) |

> ⚠️ ถ้ายังไม่มี Node.js: ดาวน์โหลดที่ [nodejs.org](https://nodejs.org) → เลือก LTS → ดับเบิลคลิกติดตั้ง

---

## ขั้นตอนที่ 1 — ดึงโค้ดล่าสุดลงเครื่อง

### 1.1 เปิด VS Code กับโฟลเดอร์ project-ms

1. เปิด **VS Code**
2. ดูที่แถบบนสุดของหน้าต่าง:
   - ถ้าเห็น `project-ms` อยู่แล้ว → ถูกต้อง ไปต่อข้อ 1.2
   - ถ้าเห็นชื่ออื่น หรือยังไม่ได้เปิดโฟลเดอร์:
     1. กดเมนู **File** (แถบบนสุดของจอ Mac)
     2. เลือก **Open Folder...**
     3. นำทางไปหาโฟลเดอร์ `project-ms` (ปกติอยู่ใน Desktop หรือ Documents)
     4. คลิกเลือก `project-ms` → กด **Open**

### 1.2 เปิด Terminal ใน VS Code

1. กดเมนู **Terminal** ที่แถบบนสุดของจอ Mac
   ```
   ┌────────────────────────────────────────────────────────────┐
   │ VS Code  File  Edit  Selection  View  Go  Run  Terminal   │
   │                                                    ↑       │
   │                                              กดตรงนี้      │
   └────────────────────────────────────────────────────────────┘
   ```
2. เลือก **New Terminal**
3. จะเห็น Terminal เปิดขึ้นด้านล่าง แสดง `...project-ms %`

> 💡 **ลัด**: กด **Ctrl + `** (ปุ่ม Control + ปุ่ม backtick ใต้ Esc) เพื่อเปิด/ปิด Terminal

### 1.3 ดึงโค้ดล่าสุด

พิมพ์ทีละบรรทัดใน Terminal แล้วกด **Enter** (Return):

**คำสั่งที่ 1 — สลับไป branch main:**
```bash
git checkout main
```
> จะเห็น: `Already on 'main'` หรือ `Switched to branch 'main'` — ปกติทั้งสองแบบ

**คำสั่งที่ 2 — ดึงโค้ดใหม่จาก GitHub:**
```bash
git pull origin main
```
> จะเห็นรายการไฟล์ที่อัปเดตวิ่งผ่าน
> ถ้าเห็น `Already up to date.` = โค้ดล่าสุดอยู่แล้ว ไม่มีอะไรใหม่

**คำสั่งที่ 3 — ตรวจสอบว่าได้โค้ดใหม่:**
```bash
ls supabase/
```
> ต้องเห็น `schema.sql` — ถ้าเห็นแปลว่าโค้ดใหม่ลงเครื่องแล้ว!

> ⚠️ **ถ้า `git pull` ขึ้น error เรื่อง conflict:**
> ```bash
> git stash
> git pull origin main
> ```
> `git stash` จะเก็บการเปลี่ยนแปลงที่ยังไม่ได้บันทึกไว้ก่อน แล้วค่อย pull

### 1.4 ติดตั้ง Dependencies

```bash
cd frontend
npm install
```
> รอประมาณ 30 วินาที - 2 นาที จนเห็นข้อความ `added XXX packages`

> ⚠️ ถ้าเจอ error `npm: command not found` → ต้องติดตั้ง Node.js ก่อน (ดูในส่วน "สิ่งที่ต้องเตรียม")

---

## ขั้นตอนที่ 2 — ตั้งค่า Supabase (ถ้ายังไม่ได้ทำ)

> ⏭️ **ถ้าทำขั้นตอนนี้แล้ว** (มี Supabase project + รัน schema.sql แล้ว) → ข้ามไปขั้นตอนที่ 3

### 2.1 สมัคร + สร้างโปรเจกต์ Supabase

1. เปิด Browser ไปที่ **[https://supabase.com](https://supabase.com)**
2. กด **"Start your project"** → เลือก **"Continue with GitHub"**
3. หลัง login → กด **"New Project"**
4. กรอก:
   - **Name**: `project-ms` (หรือชื่ออะไรก็ได้)
   - **Database Password**: กด **"Generate a password"** แล้ว **คัดลอกเก็บไว้!**
   - **Region**: เลือก **Southeast Asia (Singapore)**
5. กด **"Create new project"** → รอ 1-2 นาที

### 2.2 คัดลอก API Keys

1. หลังสร้างเสร็จ ไปที่ **Settings** (ไอคอนเฟือง ด้านล่างซ้าย)
2. คลิก **"API"** (ใต้ Configuration)
3. คัดลอก 2 ค่านี้เก็บไว้:

| ค่า | อยู่ตรงไหน | ตัวอย่าง |
|---|---|---|
| **Project URL** | หัวข้อ "Project URL" | `https://abcdefghij.supabase.co` |
| **anon public key** | หัวข้อ "Project API keys" → `anon` `public` | `eyJhbGciOiJIUzI1Ni...` (ยาวมาก) |

> ⚠️ เก็บ 2 ค่านี้ไว้ให้ดี จะใช้ในขั้นตอนถัดไป!

### 2.3 รัน SQL สร้าง Database

1. ใน Supabase Dashboard คลิก **"SQL Editor"** (เมนูซ้าย ไอคอน `<>`)
2. เปิดไฟล์ `supabase/schema.sql` ใน VS Code:
   - กดที่ **Explorer** (ไอคอนเอกสารซ้ายบน) → เปิด `supabase` → `schema.sql`
   - กด **Cmd + A** (เลือกทั้งหมด) → **Cmd + C** (คัดลอก)
3. กลับไป Supabase SQL Editor → คลิกในช่องพิมพ์ → **Cmd + V** (วาง)
4. กดปุ่ม **"Run"** (หรือ Cmd + Enter)
5. ถ้าเห็น `Success. No rows returned` = สำเร็จ!

### 2.4 ตรวจสอบ Tables

1. คลิก **"Table Editor"** (เมนูซ้าย)
2. ต้องเห็น 11 ตาราง: `profiles`, `projects`, `tasks`, `members`, `milestones`, `efforts`, `effort_monthly`, `change_requests`, `cr_items`, `issues`, `risks`

### 2.5 ตั้งค่า Authentication

1. ไปที่ **Authentication** (เมนูซ้าย ไอคอนรูปคน)
2. คลิก **"Providers"** → ตรวจสอบว่า **Email** เป็น **Enabled**
3. **สำหรับทดสอบ**: คลิก **Email** → ปิด **"Confirm email"** → กด **"Save"**

> 💡 จะเปิด Confirm email กลับในขั้นตอนที่ 7 (Production settings)

---

## ขั้นตอนที่ 3 — ตั้งค่า Environment Variables บนเครื่อง

### 3.1 สร้างไฟล์ .env.local

กลับไปที่ **Terminal ใน VS Code** (ต้องอยู่ในโฟลเดอร์ `frontend`):

```bash
# ตรวจสอบว่าอยู่ในโฟลเดอร์ frontend
pwd
```
> ต้องเห็น `.../project-ms/frontend` — ถ้าไม่ใช่ พิมพ์ `cd frontend`

```bash
# คัดลอกไฟล์ตัวอย่างเป็นไฟล์จริง
cp .env.example .env.local
```
> ไม่มีข้อความตอบ = ปกติ

### 3.2 แก้ไขไฟล์ .env.local

1. ใน VS Code มองที่ **Explorer** ด้านซ้าย
2. เปิดโฟลเดอร์ `frontend` → หาไฟล์ **`.env.local`** → คลิกเปิด
   
   > ⚠️ ถ้าไม่เห็นไฟล์: ไฟล์ที่ขึ้นต้นด้วยจุด (.) อาจถูกซ่อน
   > กด **Cmd + Shift + P** → พิมพ์ `files.exclude` → ตรวจสอบว่าไม่มีการซ่อน `.env*`
   > หรือเปิดผ่าน Terminal: `code .env.local`

3. จะเห็นเนื้อหาประมาณนี้:
   ```
   VITE_SUPABASE_URL=your_supabase_url_here
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key_here
   ```

4. **แก้ไขค่า** — เปลี่ยนเป็นค่าจริงจาก Supabase (ที่คัดลอกไว้ในขั้นตอนที่ 2.2):
   ```
   VITE_SUPABASE_URL=https://abcdefghij.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSI...
   ```
   
   > ⚠️ **สำคัญมาก**:
   > - เปลี่ยน `your_supabase_url_here` เป็น **Project URL** จริงของคุณ
   > - เปลี่ยน `your_supabase_anon_key_here` เป็น **anon key** จริงของคุณ
   > - **อย่ามีช่องว่าง** ก่อนหรือหลังเครื่องหมาย `=`
   > - **อย่ามีเครื่องหมายคำพูด** (" ") ครอบค่า

5. กด **Cmd + S** เพื่อบันทึกไฟล์

---

## ขั้นตอนที่ 4 — ทดสอบรันบนเครื่อง (Local)

### 4.1 รัน Development Server

ใน Terminal (ต้องอยู่ในโฟลเดอร์ `frontend`):

```bash
npm run dev
```

จะเห็นข้อความ:
```
  VITE v5.x.x  ready in XXX ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: http://192.168.x.x:5173/
```

### 4.2 เปิดเว็บในเครื่อง

1. เปิด **Chrome** (หรือ Browser ที่ชอบ)
2. พิมพ์ในแถบ URL: **`http://localhost:5173`** แล้วกด Enter
3. จะเห็น **หน้า Login** ของ ProjectMS

### 4.3 สมัครบัญชีทดสอบ

1. คลิก **"Create Account"**
2. กรอก:
   - **Full Name**: ชื่อของคุณ
   - **Email**: อีเมลทดสอบ เช่น `test@test.com`
   - **Password**: รหัสผ่านอย่างน้อย 6 ตัว
   - **Role**: เลือก **Admin**
3. กด **"Create Account"**
4. ถ้าเข้าหน้า **Dashboard** ได้ = ระบบทำงานปกติ!

### 4.4 ทดสอบสร้างโปรเจกต์

1. กดปุ่ม **"+"** หรือ **"New Project"** ใน Dashboard
2. กรอกข้อมูลโปรเจกต์ทดสอบ → กด Save
3. ถ้าเห็น Project Card ปรากฏ = Database ทำงานปกติ!

### 4.5 หยุด Server (เมื่อทดสอบเสร็จ)

กลับไปที่ Terminal แล้วกด **Ctrl + C** เพื่อหยุด server

> ✅ ถ้าทุกอย่างทำงานได้ = พร้อม Deploy Production!
> 
> ❌ ถ้ามีปัญหา → ดูในส่วน [การแก้ปัญหาที่พบบ่อย](#การแก้ปัญหาที่พบบ่อย)

---

## ขั้นตอนที่ 5 — Deploy Production บน Vercel

### 5.1 — กรณี A: มี Vercel project `project-ms` อยู่แล้ว

ถ้าคุณมีโปรเจกต์ `project-ms` บน Vercel อยู่แล้ว (เชื่อมกับ GitHub repo `project-ms`):

**Vercel จะ auto-deploy ทุกครั้งที่มีการ push/merge เข้า `main`**

ดังนั้นโค้ดล่าสุด (PR #3, #6, #7) ควรถูก deploy แล้วอัตโนมัติ!

**สิ่งที่ต้องตรวจสอบ:**

1. เปิด Browser ไปที่ **[https://vercel.com/dashboard](https://vercel.com/dashboard)**
2. Login ด้วย GitHub (ถ้ายังไม่ได้ login)
3. คลิกที่โปรเจกต์ **`project-ms`**
4. ตรวจสอบ 3 สิ่ง:

#### A) ตรวจสอบ Root Directory

1. กด tab **"Settings"** (แถบเมนูด้านบน)
2. ในเมนูด้านซ้าย กด **"General"**
3. เลื่อนลงหา **"Root Directory"**
4. ต้องเป็น **`frontend`**
   ```
   Root Directory:  frontend    ← ต้องเป็นแบบนี้!
   ```
5. ถ้าเป็น `./` หรือค่าอื่น → กด **Edit** → เปลี่ยนเป็น `frontend` → กด **Save**

#### B) ตรวจสอบ Framework Preset

1. ยังอยู่ในหน้า Settings → General
2. หา **"Framework Preset"**
3. ต้องเป็น **Vite**
   ```
   Framework Preset:  Vite    ← ต้องเป็นแบบนี้!
   ```

#### C) ตรวจสอบ + ตั้งค่า Environment Variables

1. ในเมนูด้านซ้าย กด **"Environment Variables"**
2. ต้องมี 2 ตัวแปร:

| Key | Value |
|---|---|
| `VITE_SUPABASE_URL` | `https://abcdefghij.supabase.co` (URL จริงของคุณ) |
| `VITE_SUPABASE_ANON_KEY` | `eyJhbGciOi...` (anon key จริงของคุณ) |

**ถ้ายังไม่มี** → เพิ่มทีละตัว:
1. ช่อง **Key**: พิมพ์ชื่อตัวแปร
2. ช่อง **Value**: วางค่าจาก Supabase
3. ตรวจสอบว่า Environments ติ๊กทั้ง **Production**, **Preview**, **Development**
4. กด **"Save"**

#### D) Redeploy (หลังเปลี่ยน Settings หรือ Env Vars)

ถ้าเปลี่ยน Root Directory, Framework, หรือ Env Vars → ต้อง Redeploy:

1. กด tab **"Deployments"** (แถบเมนูด้านบน)
2. หา deployment ล่าสุด (บรรทัดบนสุด)
3. กด **จุด 3 จุด** (⋮) ทางขวาสุดของบรรทัด
   ```
   ┌────────────────────────────────────────────────────┐
   │  ✓ Ready   main   3m ago   abcdef1        ⋮       │
   │                                            ↑       │
   │                                      กดจุด 3 จุดนี้ │
   └────────────────────────────────────────────────────┘
   ```
4. เลือก **"Redeploy"**
5. จะมี popup ขึ้น → กด **"Redeploy"** อีกครั้ง
6. รอ 1-3 นาทีจนเสร็จ

---

### 5.2 — กรณี B: ยังไม่มี Vercel project (ต้องสร้างใหม่)

1. ไปที่ **[https://vercel.com/dashboard](https://vercel.com/dashboard)**
2. กดปุ่ม **"Add New..."** (มุมขวาบน) → เลือก **"Project"**
3. หา **`project-ms`** ในรายการ repo → กด **"Import"**
   > ถ้าไม่เห็น → กด **"Adjust GitHub App Permissions"** → เลือก repo → Save → Refresh
4. ตั้งค่า:
   - **Framework Preset**: เลือก **Vite**
   - **Root Directory**: กด Edit → เลือก **`frontend`** → Continue
5. เพิ่ม **Environment Variables** (2 ตัวตามตารางด้านบน)
6. กด **"Deploy"**
7. รอ 1-3 นาที → จะเห็น **"Congratulations!"** พร้อม URL ของเว็บ

---

### 5.3 ดู Production URL

หลัง deploy สำเร็จ:

1. กด tab **"Settings"** → **"Domains"** ในเมนูซ้าย
2. จะเห็น URL ของเว็บ เช่น:
   - `project-ms.vercel.app` (หรือ `project-ms-xxxx.vercel.app`)
3. **คัดลอก URL นี้ไว้** — จะใช้ในขั้นตอนถัดไป

> 💡 ถ้าต้องการ Custom Domain (เช่น `pm.yourcompany.com`):
> กด **"Add"** ในหน้า Domains → พิมพ์ domain → ทำตามคำแนะนำ DNS

---

## ขั้นตอนที่ 6 — ตั้งค่า Supabase ให้รองรับ Production URL

### 6.1 ตั้งค่า Site URL

1. เปิด **Supabase Dashboard** → เข้าโปรเจกต์ของคุณ
2. ไปที่ **Authentication** (เมนูซ้าย) → **URL Configuration**
3. ในช่อง **Site URL** → ใส่ Production URL จาก Vercel:
   ```
   https://project-ms.vercel.app
   ```
   (เปลี่ยนเป็น URL จริงของคุณ)
4. กด **"Save"**

### 6.2 เพิ่ม Redirect URLs

ยังอยู่ในหน้า URL Configuration:

1. ในส่วน **"Redirect URLs"** กด **"Add URL"**
2. เพิ่ม 2 URLs (เพิ่มทีละตัว กด Add URL ทุกครั้ง):
   ```
   https://project-ms.vercel.app/**
   ```
   ```
   http://localhost:5173/**
   ```
3. กด **"Save"**

> 💡 URL ที่ 2 (`localhost`) สำหรับทดสอบบนเครื่องตัวเอง

---

## ขั้นตอนที่ 7 — ตั้งค่า Production สำหรับใช้งานจริง

### 7.1 เปิด Email Confirmation (แนะนำสำหรับ Production)

เมื่อพร้อมใช้งานจริง ควรเปิดให้ผู้ใช้ยืนยัน email:

1. ไปที่ **Supabase Dashboard** → **Authentication** → **Providers** → คลิก **Email**
2. เปิด **"Confirm email"** (toggle ให้เป็นสีเขียว)
3. กด **"Save"**

> ⚠️ หลังเปิด: ผู้ใช้ที่สมัครใหม่ต้องกดลิงก์ยืนยันในอีเมลก่อนจึงจะ login ได้

### 7.2 ตรวจสอบ RLS (Row Level Security)

1. ไปที่ **Table Editor** → คลิกตารางใดก็ได้ เช่น `projects`
2. ดูแถบด้านบน ต้องเห็น **"RLS enabled"** เป็นสีเขียว
3. ตรวจสอบทุกตาราง — ทุกตารางต้อง RLS enabled

### 7.3 (ถ้าต้องการ) ตั้งค่า Custom SMTP สำหรับ Email

Supabase ส่ง email ยืนยันให้ฟรี แต่มีจำกัด 4 emails/ชั่วโมง (Free Tier)

ถ้าต้องการส่ง email มากกว่านั้น:
1. ไปที่ **Settings** → **Authentication** → **SMTP Settings**
2. เปิด **"Enable Custom SMTP"**
3. กรอกข้อมูล SMTP ของคุณ (เช่น Gmail, SendGrid, Mailgun)

---

## ขั้นตอนที่ 8 — ทดสอบ Production

### 8.1 เปิดเว็บ Production

1. เปิด Browser ไปที่ URL จาก Vercel เช่น `https://project-ms.vercel.app`
2. ต้องเห็น **หน้า Login**

### 8.2 สมัครบัญชี Admin

1. คลิก **"Create Account"**
2. กรอก:
   - **Full Name**: ชื่อจริงของคุณ
   - **Email**: อีเมลจริง (ต้องรับ email ยืนยันได้ ถ้าเปิด Confirm email)
   - **Password**: รหัสผ่านที่แข็งแรง
   - **Role**: เลือก **Admin**
3. กด **"Create Account"**
4. ถ้าเปิด Email Confirmation → ไปเปิดอีเมล → กดลิงก์ยืนยัน → กลับมา login

### 8.3 ทดสอบฟีเจอร์หลัก

| ทดสอบ | วิธีทำ | ผลที่ต้องเห็น |
|---|---|---|
| สร้างโปรเจกต์ | กด "+" → กรอกข้อมูล → Save | เห็น Project Card |
| สร้าง Task | เข้าโปรเจกต์ → Tasks → เพิ่ม Task | เห็น Task + Gantt bar |
| สร้าง Subtask | กด "+" ที่ Task → เพิ่ม Task ย่อย | เห็น Subtask เยื้อง + parent date อัปเดต |
| Zoom Gantt | กดปุ่ม +/- ข้าง zoom | เปลี่ยนระดับ Day→Week→HalfMo→Month→Quarter |
| Export PDF | กดปุ่ม Export PDF | ได้ PDF ซ้าย=ตาราง ขวา=Gantt |
| Dark Mode | กดไอคอน ☀️/🌙 | สีพื้นหลังเปลี่ยน |
| Hypercare | เปลี่ยนสถานะโปรเจกต์เป็น Hyper Care | โปรเจกต์ย้ายไปส่วน Hyper Care |

---

## การอัปเดตโค้ดในอนาคต

### วิธีที่ 1 — อัปเดตอัตโนมัติผ่าน Vercel (แนะนำ)

เมื่อมีโค้ดใหม่ merge เข้า `main` บน GitHub → **Vercel จะ deploy ใหม่อัตโนมัติ!**

คุณไม่ต้องทำอะไรเพิ่ม — แค่ merge PR บน GitHub แล้ว Vercel จะอัปเดตให้

### วิธีที่ 2 — ดึงโค้ดใหม่ลงเครื่อง (สำหรับ Local Development)

ทุกครั้งที่มีโค้ดใหม่บน GitHub:

```bash
# ใน Terminal ที่ VS Code (โฟลเดอร์ project-ms)
git checkout main
git pull origin main
cd frontend
npm install
npm run dev
```

---

## การแก้ปัญหาที่พบบ่อย

### ❌ หน้าเว็บขึ้น "Connection Error"

**สาเหตุ**: ไม่ได้ตั้งค่า Supabase credentials หรือค่าผิด

**วิธีแก้**:
1. **Local**: ตรวจสอบไฟล์ `frontend/.env.local` ว่ามีค่า `VITE_SUPABASE_URL` และ `VITE_SUPABASE_ANON_KEY` ถูกต้อง
2. **Vercel**: ไปที่ Settings → Environment Variables → ตรวจค่า → ถ้าแก้แล้วต้อง **Redeploy**
3. ตรวจสอบว่า URL **ไม่มี `/` ต่อท้าย** และ **ไม่มีช่องว่าง**

### ❌ Vercel Build Error

**วิธีแก้**:
1. ตรวจสอบ **Root Directory** = `frontend` (Settings → General)
2. ตรวจสอบ **Framework Preset** = Vite
3. ดู Build Logs: Deployments → คลิก deployment ที่ error → ดู log

### ❌ สมัครบัญชีแล้วไม่เข้า

**สาเหตุ**: Email confirmation เปิดอยู่

**วิธีแก้**:
- **วิธี A**: ไปเปิดอีเมล → กดลิงก์ยืนยัน
- **วิธี B**: ปิด Email confirmation ชั่วคราวใน Supabase
- **วิธี C**: Supabase Dashboard → Authentication → Users → หาอีเมล → กดจุด 3 จุด → **"Confirm user"**

### ❌ `npm install` ล้มเหลว

**วิธีแก้**:
```bash
# ลบ node_modules แล้วลองใหม่
rm -rf node_modules
npm install
```

### ❌ `npm run dev` ล้มเหลว

**วิธีแก้**:
```bash
# ตรวจสอบ Node.js version
node -v
# ต้องเป็น v18 ขึ้นไป

# ถ้าต่ำกว่า v18 → ดาวน์โหลดใหม่ที่ nodejs.org
```

### ❌ Vercel Environment Variables ไม่ทำงาน

**วิธีแก้**:
1. ชื่อตัวแปรต้อง **ขึ้นต้นด้วย `VITE_`** (สำคัญมาก!)
2. หลังเพิ่ม/แก้ env vars ต้อง **Redeploy** ใหม่
3. ตรวจสอบว่า env vars ถูกตั้งสำหรับ **Production** environment (ติ๊กถูกที่ Production)

### ❌ CORS Error

**สาเหตุ**: Supabase ไม่รู้จัก URL ของเว็บ

**วิธีแก้**:
1. Supabase Dashboard → Authentication → URL Configuration
2. ตรวจสอบ **Site URL** = URL จริงของ Vercel
3. ตรวจสอบ **Redirect URLs** มี URL ของ Vercel + `/**`

---

## สรุปภาพรวม

```
┌──────────────────────────────────────────────────────────────────┐
│                     ขั้นตอนการ Deploy Production                  │
│                                                                  │
│  ① ดึงโค้ดล่าสุด (git pull)                                      │
│  ② ตั้งค่า Supabase (DB + Auth)                                  │
│  ③ สร้าง .env.local                                              │
│  ④ ทดสอบ Local (npm run dev)                                     │
│  ⑤ Deploy Vercel (ตั้ง Root=frontend + Env Vars)                 │
│  ⑥ ตั้ง Supabase URL Configuration                              │
│  ⑦ เปิด Production settings (Email Confirm, RLS)                │
│  ⑧ ทดสอบ Production                                             │
│                                                                  │
│  ┌──────────┐     ┌──────────┐     ┌──────────────────┐         │
│  │  GitHub   │────→│  Vercel  │────→│    Supabase      │         │
│  │  (โค้ด)   │     │ (เว็บ)   │     │ (DB + Auth +     │         │
│  │          │     │          │     │  Realtime)       │         │
│  └──────────┘     └──────────┘     └──────────────────┘         │
│       │                │                    │                    │
│  Push/Merge →    Auto Deploy →     เก็บข้อมูล +              │
│  โค้ดใหม่         สร้างเว็บใหม่     ตรวจสอบสิทธิ์              │
│                                                                  │
│  💡 ทุกครั้งที่ merge PR ใหม่ → Vercel deploy อัตโนมัติ!         │
└──────────────────────────────────────────────────────────────────┘
```
