# IT Request System

โครงสร้างโปรเจกต์แยก frontend และ backend แล้ว

```text
itreq/
├── frontend/   # React + Vite
└── backend/    # Node.js + Express + PM2
```

## Frontend

```bash
cd frontend
npm install
cp .env.example .env
npm run build
```

`npm run build` จะสร้างไฟล์ production ไปที่ `../backend/dist` เพื่อให้ backend serve ที่ path `/itrequest/`

## Backend

ลายเซ็น IT แยกเป็นสองช่วง: ลงนามรับงานหลังอนุมัติครบก่อนเริ่มงาน และลงนามยืนยันงานเสร็จก่อนปิดงาน โดยเจ้าหน้าที่ IT หรือ Admin เปิดเอกสารจากเมนู งาน IT แล้วคลิกช่องลายเซ็น รองรับวาดลายเซ็นหรือใช้ลายเซ็นเดิมในระบบ

กำหนดทุกช่องในตาราง **ช่องเซ็นอนุมัติ** ของหน้าแก้ฟอร์ม โดยเลือก **ช่วงเซ็น** เป็น อนุมัติคำขอ / หลังอนุมัติ ก่อนเริ่มงาน / งานเสร็จ ก่อนปิดงาน และเลือกผู้เซ็นแบบกำหนดตายตัว ผู้ขอเลือก หรือเจ้าหน้าที่ IT ที่รับงาน ใช้ปุ่มขึ้น/ลงเพื่อกำหนดลำดับภายในแต่ละช่วง ระบบจะส่งอีเมลเมื่อถึงช่วงนั้น ช่องของคำขอที่สร้างแล้วเก็บค่าตามตอนสร้าง การแก้ฟอร์มมีผลกับคำขอใหม่

ก่อนใช้งานบนเครื่องใหม่หรืออัปเดตระบบ ให้รันจากโฟลเดอร์ `backend`:

```bash
node server/scripts/applyITSignaturesMigration.js
node server/scripts/applyITSignatureSettingsMigration.js
node server/scripts/applySigningStagesMigration.js
```

เพิ่มตัวแปรใน Word template ตามตำแหน่งที่ต้องการ:

| ช่วง | ชื่อผู้เซ็น | วันที่ | รูปลายเซ็น |
| --- | --- | --- | --- |
| รับงาน | `{{it_acceptance_name}}` | `{{it_acceptance_signed_at}}` | `{{%it_acceptance_signature}}` |
| งานเสร็จ | `{{it_completion_name}}` | `{{it_completion_signed_at}}` | `{{%it_completion_signature}}` |

รองรับ `it_acceptance_emp_id`, `it_acceptance_comment`, `it_completion_emp_id` และ `it_completion_comment` ด้วย

```bash
cd backend
npm install
cp .env.example .env
nano .env
mkdir -p logs
npm run start
```

Health check:

```bash
curl http://127.0.0.1:5101/itrequest/api/health
```

Telegram notifications:

```env
TELEGRAM_BOT_TOKEN=123456:your_bot_token
TELEGRAM_CHAT_ID=123456789
PUBLIC_BASE_URL=https://your-domain.example
```

Use `TELEGRAM_CHAT_IDS=123,456` for multiple chat IDs.

## PM2

```bash
cd backend
pm2 start ecosystem.config.cjs --env production
pm2 save
pm2 logs itrequest
```

เปิดใช้งาน:

```text
http://SERVER_IP:5101/itrequest/
```

## Root Scripts

จาก root ของโปรเจกต์:

```bash
npm run install:all
npm run build
npm run dev:frontend
npm run dev:backend
```
