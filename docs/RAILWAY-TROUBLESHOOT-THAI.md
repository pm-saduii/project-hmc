# 🔧 Troubleshooting Railway - "Application not found" Error

**Error ที่เข้า:** 
```
{"status":"error","code":404,"message":"Application not found"}
```

**ความหมาย:** Backend ยังไม่ได้ deployed สำเร็จ

---

## 🎯 ตรวจสอบทีละขั้นตอน

### ✅ ขั้นตอนที่ 1: ตรวจ Deploy Status ใน Railway (5 นาที)

#### 1.1 ไปที่ Railway Dashboard

1. เปิด https://railway.app/dashboard
2. เลือกโครงการ "ProjectMS Backend"
3. ดู **"Deployments"** tab

#### 1.2 ดู Status ของ Deployment

ควรเห็นอย่างใดอย่างหนึ่ง:

```
✅ Status: SUCCESS
   → Backend ปล่อยสำเร็จแล้ว!
   → ลองอีกคำสั่ง curl

🟡 Status: BUILDING
   → ยังกำลัง build อยู่
   → รอ 2-3 นาที

❌ Status: FAILED
   → Deploy fail แล้ว
   → ต้องดู Logs (ขั้นตอนที่ 3)

⏳ Status: QUEUED/INITIALIZED
   → ยังไม่เริ่ม deploy
   → มักใช้เวลา 1-2 นาที
```

#### 1.3 ถ้า Status ยังไม่ SUCCESS

1. รอสักคร่าว
2. Refresh หน้า
3. ดูว่า updated เมื่อไหร่

---

### ✅ ขั้นตอนที่ 2: ตรวจ Environment Variables (5 นาที)

#### 2.1 ไปที่ Variables Tab

1. Railway Dashboard → ProjectMS Backend
2. เลือก service **"project-ms"** (หรือชื่อ backend service)
3. ไปที่ **"Variables"** tab

#### 2.2 ตรวจสิ่งเหล่านี้

ต้องมี **อย่างน้อย 4 ตัว**:

```
✓ NODE_ENV           = production
✓ PORT               = 8080
✓ SUPABASE_URL       = https://xxxxx.supabase.co
✓ SUPABASE_SERVICE_KEY = eyJhbGc...
```

#### 2.3 ถ้าขาดตัวไหน?

1. กด **"New Variable"** (สีฟ้า)
2. เพิ่มตัวที่ขาด
3. หลังจากเพิ่ม → **Redeploy**

```bash
# Railway จะ auto-redeploy เมื่อ save variables
# หรือ ไปที่ Deployments → กด "Redeploy"
```

---

### ✅ ขั้นตอนที่ 3: ดู Deployment Logs (10 นาที)

#### 3.1 ไปที่ Logs

1. Railway Dashboard → ProjectMS Backend
2. ดู **"Deployments"** tab
3. คลิก deployment ล่าสุด
4. ไปที่ **"Logs"** tab

#### 3.2 อ่านค้นหา Error

**ดูข้อมูลตามความสำคัญ:**

```
🔴 CRITICAL - หา:
   ┌─────────────────────────────────────────┐
   │ error                                    │
   │ ENOENT (file not found)                 │
   │ Cannot find module                      │
   │ SyntaxError                             │
   │ Connection refused                      │
   └─────────────────────────────────────────┘

🟡 WARNING - ดู:
   ┌─────────────────────────────────────────┐
   │ Build failed                            │
   │ npm ERR!                                │
   │ Supabase connection failed              │
   │ CORS error                              │
   └─────────────────────────────────────────┘

✅ GOOD - ต้องเห็น:
   ┌─────────────────────────────────────────┐
   │ ✅ Connected to Supabase                │
   │ 🚀 ProjectMS API on http://localhost   │
   │ Server listening on port 8080           │
   └─────────────────────────────────────────┘
```

#### 3.3 Common Errors

**❌ "Cannot find module '@supabase/supabase-js'"**
```
วิธีแก้:
1. ตรวจ backend/package.json มี @supabase/supabase-js ไหม
   (ดู: dependencies → @supabase/supabase-js)
2. ถ้าไม่มี → หลังจากเพิ่ม ต้อง git push
3. Railway จะ auto-redeploy
```

**❌ "Port already in use"**
```
วิธีแก้:
1. ตรวจ PORT ใน Environment Variables
2. ระบุ PORT = 8080 (ไม่ใช่ 3001)
3. Save → Redeploy
```

**❌ "SUPABASE connection failed"**
```
วิธีแก้:
1. ตรวจ SUPABASE_URL ใน Railway env vars
2. ตรวจ SUPABASE_SERVICE_KEY (ต้องยาว)
3. ตรวจ Supabase account ยัง active ไหม
4. Copy ใหม่จาก Supabase Settings → API
```

---

### ✅ ขั้นตอนที่ 4: ตรวจ GitHub ว่า Push ไปแล้ว (5 นาที)

#### 4.1 ดู Git Commit

```bash
# Terminal
cd /Volumes/DATA/Web/ProjectMS/project-ms
git log --oneline -5

# ควรเห็น commit ล่าสุด:
# 55286ff docs: Add detailed Thai guides...
# 13b573d feat: Complete Supabase migration...
```

#### 4.2 ตรวจว่า Push ไปแล้ว

```bash
git remote -v

# ควรเห็น:
# origin  https://github.com/[your-username]/project-ms.git
```

#### 4.3 ถ้ายังไม่ push

```bash
git push origin main

# รอให้ push เสร็จ
# GitHub Actions จะ auto-trigger deploy-backend.yml
```

---

### ✅ ขั้นตอนที่ 5: Manual Trigger Deploy ใน Railway (5 นาที)

#### 5.1 ไปที่ Deployments

1. Railway Dashboard → ProjectMS Backend
2. ไปที่ **"Deployments"** tab

#### 5.2 Redeploy

1. ด้านบนสุด ควรเห็น **"Deploy"** ปุ่ม
2. เลือก **branch: main**
3. กด **"Deploy"**
4. รอ 2-3 นาที

#### 5.3 ตรวจ Status

1. Deployment ล่าสุดควร status **"Building"**
2. รอให้เปลี่ยนเป็น **"Success"** ✅

---

## 🎯 Quick Checklist: ทำแบบนี้เพื่อแก้ปัญหา

```
┌─ ขั้นที่ 1: ตรวจ Deploy Status
│  ☐ ไป Railway Dashboard
│  ☐ ดู Deployments tab
│  ☐ Status = SUCCESS? (ถ้าใช่ → ข้ามขั้นต่อไป)
│
├─ ขั้นที่ 2: ตรวจ Environment Variables
│  ☐ เลือก Variables tab
│  ☐ มี 4+ variables ไหม?
│  ☐ SUPABASE_URL ถูกต้องไหม?
│  ☐ ถ้าผิด → แก้ + Save + Redeploy
│
├─ ขั้นที่ 3: ดู Logs
│  ☐ กด Deployment ล่าสุด
│  ☐ ดู Logs tab
│  ☐ มี ERROR ไหม?
│  ☐ ถ้ามี → แก้ code + git push
│
├─ ขั้นที่ 4: ตรวจ GitHub Push
│  ☐ git log --oneline -5
│  ☐ Commit ล่าสุดมี ไหม?
│  ☐ ถ้าไม่มี → git push origin main
│
└─ ขั้นที่ 5: Manual Redeploy
   ☐ กด Deploy button
   ☐ เลือก main branch
   ☐ รอให้ Success
   ☐ ลอง curl อีกครั้ง
```

---

## 🔍 ถ้ายังไม่เข้าใจ - ลองหลายเทคนิค

### Technique 1: Simple Test

```bash
# ลอง URL อื่นๆ
curl https://projectms-backend-production.up.railway.app/health

# ถ้าได้ 200
# → backend working
# → API /api/projects อาจติด

# ถ้ายังได้ 404
# → backend ไม่ running
```

### Technique 2: ดู Public URL

1. Railway Dashboard → project-ms service
2. ด้านขวา ควรเห็น **"Visit"** link
3. กด → ไปยัง public URL
4. ควรเห็น error หรือ page

### Technique 3: ตรวจ Service

1. Railway Dashboard → ProjectMS Backend
2. ดูด้านซ้าย
3. ควรเห็น service ชื่อ "project-ms"
4. ถ้าไม่เห็น → ต้อง setup ใหม่

---

## 📋 สมมติฐาน & วิธีแก้

| สมมติฐาน | วิธีตรวจสอบ | วิธีแก้ |
|---|---|---|
| Backend ยังไม่ deploy | Railway Deployments = "Building" | รอ 2-3 นาที |
| Env vars ขาด | Railway Variables = < 4 items | เพิ่ม variables |
| Env vars ผิด | ตรวจ SUPABASE_URL ใน logs | Copy ใหม่ |
| Code ไม่ push | git log ไม่เห็น commit ล่าสุด | git push origin main |
| GitHub Actions fail | GitHub Actions tab = red ❌ | ดู workflow logs |
| Package.json ไม่อาปเดต | Logs "Cannot find module" | ตรวจ @supabase/supabase-js |

---

## ✅ เมื่อไหร่คือ "Success"?

```
ถ้าได้ response นี้:
───────────────────────
{
  "success": true,
  "data": [...]  // project list
}
───────────────────────

หรือ (ถ้า database ว่าง):
───────────────────────
{
  "success": true,
  "data": []  // empty
}
───────────────────────

→ ✅ SUCCESS! Backend working!
```

---

## 🎯 Next Steps

### ถ้า Deploy Success ✅
```
1. ลอง curl อีกครั้ง
2. ดู data ที่ได้
3. ไปตั้ง Vercel (VERCEL-SETUP-THAI.md)
```

### ถ้า Deploy ยังไม่ Success ❌
```
1. ดา Logs ดีๆ
2. หาว่า error ตัวไหน
3. แก้โค้ด / environment
4. git push → Railway auto-redeploy
```

---

## 💬 ถ้ายังติด?

**ให้ผมดู:**
1. Railway Deployments tab → Status (screenshot)
2. Railway Logs → Error message (copy-paste)
3. Environment Variables → มีอะไร (list out)
4. git log --oneline -1 (latest commit)

ผมจะซ่อม! 💪

