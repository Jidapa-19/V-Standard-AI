# AI Instructor Assistant V1.0

เว็บแชทบอทสำหรับหลักสูตร **มาตรฐานพนักงาน (V)** ตอบคำถามจากข้อมูลหลักสูตรเท่านั้น และวิเคราะห์ภาพ (JPG/PNG/WEBP) ด้วย Gemini API พร้อมตรวจสอบคำตอบกับ `course.json` ฝั่ง Backend

- Frontend: React + Vite (CSS Responsive, Dark/Light Mode)
- Backend: Node.js + Express, `@google/genai`, Multer (memory storage), dotenv
- Knowledge Base: `server/course.json`

---

## โครงสร้างโปรเจกต์

```
ai_instructor_assistant/
├─ .gitignore
├─ README.md
├─ client/                 React + Vite
│  ├─ index.html
│  ├─ vite.config.js       proxy /api -> http://127.0.0.1:3001
│  └─ src/ main.jsx, App.jsx, App.css
└─ server/                 Express API
   ├─ .env.example         ตัวอย่างค่าตั้งค่า (ไม่มี API Key จริง)
   ├─ index.js             POST /api/chat, GET /api/health
   ├─ instructorPrompt.js  System Instruction + JSON Schema
   ├─ validation.js        ตรวจไฟล์ภาพ + ตรวจคำตอบ AI กับ course.json
   ├─ course.json          ข้อมูลหลักสูตร
   └─ test/                unit.test.js, live.test.js, fixtures/
```

---

## ติดตั้งและเปิดใช้งานบน Windows

### 1. ติดตั้ง Node.js
ติดตั้ง Node.js 20 ขึ้นไป (แนะนำ LTS) จาก https://nodejs.org
ตรวจสอบใน PowerShell:
```powershell
node -v
npm.cmd -v
```

> **หมายเหตุ PowerShell:** หากพิมพ์ `npm` แล้วขึ้น *"running scripts is disabled on this system"* ให้ใช้ `npm.cmd` แทน `npm` (ใช้ได้ทุกคำสั่งในคู่มือนี้) หรือใช้ Command Prompt (cmd)

### 2. ติดตั้ง Dependencies
```powershell
cd server
npm.cmd install
cd ..\client
npm.cmd install
cd ..
```

### 3. สร้างไฟล์ `server/.env` (ทำเอง)
```powershell
Copy-Item server\.env.example server\.env
notepad server\.env
```
ใส่ API Key จาก https://aistudio.google.com/apikey :
```
GEMINI_API_KEY=ใส่คีย์จริงของคุณที่นี่
GEMINI_MODEL=gemini-2.5-flash
```

> [!CAUTION]
> ห้าม commit หรือแชร์ไฟล์ `server/.env` (มีใน `.gitignore` แล้ว) และห้ามใส่ API Key ในโฟลเดอร์ `client/`

### 4. รันระบบ (โหมดพัฒนา — เปิด 2 หน้าต่าง PowerShell)

หน้าต่างที่ 1 — Backend:
```powershell
cd server
npm.cmd run dev
```
ต้องเห็น `AI configured: true`

หน้าต่างที่ 2 — Frontend:
```powershell
cd client
npm.cmd run dev
```
เปิดเบราว์เซอร์ที่ **http://localhost:5173**

### 5. รันแบบ Production (พอร์ตเดียว)
```powershell
cd client
npm.cmd run build
cd ..\server
npm.cmd start
```
เปิด **http://localhost:3001** (Backend จะเสิร์ฟไฟล์จาก `client/dist`)

### ใช้งานจากมือถือในวง LAN เดียวกัน
1. ใน `server/.env` ตั้ง `HOST=0.0.0.0` และเพิ่ม `http://<IP เครื่อง>:3001` ใน `ALLOWED_ORIGINS`
2. รันแบบ Production แล้วเปิด `http://<IP เครื่อง>:3001` บนมือถือ
3. อาจต้องอนุญาตพอร์ต 3001 ใน Windows Firewall

---

## ค่าตั้งค่า (`server/.env`)

| ตัวแปร | ค่าเริ่มต้น | คำอธิบาย |
|---|---|---|
| `GEMINI_API_KEY` | (ว่าง) | API Key — เก็บที่นี่เท่านั้น |
| `GEMINI_MODEL` | `gemini-2.5-flash` | ชื่อโมเดล Gemini |
| `PORT` / `HOST` | `3001` / `127.0.0.1` | พอร์ตและที่อยู่ของ Backend |
| `ALLOWED_ORIGINS` | localhost:5173, localhost:3001 | โดเมนที่อนุญาต (CORS) คั่นด้วย comma |
| `RATE_LIMIT_PER_MINUTE` | `20` | จำนวนคำขอต่อนาทีต่อ IP |
| `GEMINI_TIMEOUT_MS` | `30000` | เวลารอ Gemini สูงสุด |

---

## API

### `POST /api/chat` (multipart/form-data)
| field | ชนิด | ข้อจำกัด |
|---|---|---|
| `message` | text | ไม่เกิน 1,000 ตัวอักษร |
| `images` | file | JPG/PNG/WEBP, สูงสุด 3 ไฟล์, ไฟล์ละไม่เกิน 5 MB |

ตอบกลับ:
```json
{ "answer": "...ค่ะ", "refused": false, "reason": null,
  "sources": [{ "id": "checkin_time", "topic": "เวลาเช็คอิน", "value": "08.30 น." }] }
```
ฟิลด์อื่น (เช่น `course` ที่ Frontend ส่งมา) จะถูกละเลย — Backend ใช้เฉพาะ `server/course.json`

### `GET /api/health`
`{ "status": "ok", "aiConfigured": true, "courseName": "..." }`

---

## Backend ตรวจสอบอะไรจริงบ้าง

**ไฟล์ภาพ**
- ตรวจ MIME type ที่ประกาศ **และ** magic bytes ของเนื้อหาไฟล์ (ต้องตรงกัน)
- จำกัดขนาด จำนวนไฟล์ ชื่อฟิลด์ และขนาดข้อความ
- เก็บภาพในหน่วยความจำเท่านั้น ไม่เขียนลงดิสก์ และไม่บันทึก Log เนื้อหาภาพ/ข้อความ

**คำตอบจาก AI** — Gemini ต้องตอบเป็น JSON (`imageReadable, imageText, answerable, citedFactIds, answer`) แล้ว Backend จะ **แทนที่ด้วยข้อความปฏิเสธจาก course.json** ถ้า:
1. JSON ไม่ถูกต้อง หรือ `answerable=false`
2. แนบภาพแต่ `imageReadable=false` (ภาพอ่านไม่ได้)
3. ไม่มี `citedFactIds` ที่มีอยู่จริงใน course.json
4. คำตอบมีตัวเลข (วันที่/เวลา/จำนวน) ที่ไม่อยู่ใน fact ที่อ้างอิง คำถามผู้ใช้ หรือข้อความที่อ่านได้จากภาพ
5. คำตอบไม่มีภาษาไทย

> [!NOTE]
> การตรวจสอบนี้เป็นกฎตายตัว (citation + ตัวเลข) ไม่ได้ตรวจความหมายทุกคำ ข้อความที่ไม่ใช่ตัวเลขยังอาศัยกฎใน System Instruction เป็นหลัก UI แสดงหัวข้อ "อ้างอิงข้อมูลหลักสูตร" จาก fact ที่ผ่านการตรวจเท่านั้น

**ป้องกัน Prompt Injection**
- System Instruction สร้างจาก course.json ฝั่งเซิร์ฟเวอร์ ไม่มีข้อความผู้ใช้ปนอยู่
- ข้อความผู้ใช้ถูกห่อในบล็อก `USER_QUESTION` และระบุว่าเป็นข้อมูลไม่น่าเชื่อถือ
- ภาพถูกส่งเป็น `inlineData` และกำหนดว่าข้อความในภาพไม่ใช่คำสั่ง

**อื่นๆ**: CORS allowlist, Rate limit, แปลงข้อผิดพลาดของ Gemini (429/401/403/timeout) เป็นข้อความที่ปลอดภัย, ไม่ส่ง Stack Trace ให้ผู้ใช้, API Key อยู่ใน `server/.env` เท่านั้น

---

## การทดสอบ

### Unit / Integration (ไม่ต้องใช้ API Key)
```powershell
cd server
npm.cmd test
```
ครอบคลุม: การตรวจคำตอบ, ข้อความปฏิเสธ, ตัวเลขที่แต่งขึ้น, fact id ปลอม, ภาพอ่านไม่ได้, ไฟล์ที่ไม่ใช่ภาพ, MIME ปลอม, ไฟล์เกิน 5 MB, เกิน 3 ไฟล์, CORS, Rate limit, Gemini 429/คีย์ผิด, ไม่มี Stack Trace, ไม่รับ course จาก Client

### Live (เรียก Gemini จริง — ต้องมี `server/.env`)
```powershell
cd server
npm.cmd run test:live
```
ครอบคลุม: วันอบรม, เวลาเช็คอิน (สะกดผิด), ข้อเน้นย้ำ, คำถามไม่มีข้อมูล, injection ในข้อความ, ภาพตรงหลักสูตร, ภาพข้อมูลผิด, ภาพเบลอ, คำสั่งแฝงในภาพ
ภาพทดสอบอยู่ใน `server/test/fixtures/` (สร้างใหม่ได้ด้วย `powershell -ExecutionPolicy Bypass -File server\test\make-fixtures.ps1`)

> ผลของ AI อาจต่างกันเล็กน้อยในแต่ละครั้ง หาก test live ล้มเหลว ให้ดูคำถาม/คำตอบที่พิมพ์ออกมาเพื่อวิเคราะห์

### ตรวจว่า API Key ไม่หลุดไป Browser
```powershell
cd client
npm.cmd run build
Select-String -Path dist\* -Pattern "AIza","GEMINI_API_KEY=" -SimpleMatch
```
ต้องไม่พบผลลัพธ์ และใน DevTools > Network ต้องเห็นเฉพาะคำขอไป `/api/chat` (ไม่มีคำขอไป `generativelanguage.googleapis.com`)

### ทดสอบด้วยมือ (UI Checklist)
- [ ] ถาม "อบรมวันไหน", "เชคอินกี่โมง", "มีข้อเน้นย้ำอะไรบ้าง"
- [ ] ถาม "มีอาหารกลางวันไหม" → ได้ข้อความปฏิเสธตรงตามต้นฉบับ
- [ ] แนบภาพ, ดู Preview, กดลบภาพ, วางภาพด้วย Ctrl+V, ลากภาพมาวาง
- [ ] Enter ส่ง / Shift+Enter ขึ้นบรรทัดใหม่ (รวมถึงขณะพิมพ์ภาษาไทย)
- [ ] ปุ่มคัดลอกคำตอบ, ปุ่มล้างประวัติ, ปุ่มสลับโหมดมืด/สว่าง
- [ ] ลองแนบไฟล์ .txt หรือภาพเกิน 5 MB → แสดงข้อผิดพลาด
- [ ] เปิดบนมือถือ / ย่อหน้าต่างเหลือ ~390px

---

## แก้ปัญหาที่พบบ่อย

| อาการ | วิธีแก้ |
|---|---|
| `npm : ... running scripts is disabled` | ใช้ `npm.cmd` แทน `npm` |
| `node` is not recognized | ติดตั้ง Node.js ใหม่ หรือเพิ่ม `C:\Program Files\nodejs` ใน PATH แล้วเปิด PowerShell ใหม่ |
| แชทขึ้น "ยังไม่ได้ตั้งค่า GEMINI_API_KEY" | สร้าง `server/.env` แล้วรีสตาร์ท Backend |
| "การตั้งค่าบริการ AI ไม่ถูกต้อง" | API Key ผิด หรือชื่อ `GEMINI_MODEL` ไม่มีอยู่ |
| "โดเมนนี้ไม่ได้รับอนุญาต" | เพิ่ม URL ที่เปิดเว็บลงใน `ALLOWED_ORIGINS` |
| "ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้" | ตรวจว่า Backend รันอยู่ที่พอร์ต 3001 |

## แก้ไขข้อมูลหลักสูตร
แก้ `server/course.json` (แต่ละข้อมูลต้องมี `id` ไม่ซ้ำ, `topic`, `value`) แล้วรีสตาร์ท Backend
