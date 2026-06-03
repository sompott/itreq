# IT Request System

ต้นแบบระบบขอใช้งาน IT ตาม `IT_Request_System_Spec.md`

## ทำงานแล้ว

- React UI แนวผสม Wizard + Digital document
- Mock API สำหรับผู้ใช้, ประเภทคำขอ, ฟอร์ม dynamic, ช่องอนุมัติ, รายชื่อพนักงาน
- วาดลายเซ็นบน canvas หรือใช้ URL รูปพนักงานเดิม
- ส่งคำขอ / บันทึกร่างแบบ mock
- Endpoint สำหรับ template variables: `/itrequest/api/requests/:id/template-data`

## Mock ไว้ก่อน

- Verify cookie จากระบบ .NET เดิม
- Query MySQL ระบบเดิมสำหรับพนักงาน
- Write MySQL ระบบใหม่
- SMTP Outlook
- Export Word/PDF ด้วย docxtemplater

## Run

```bash
npm.cmd install
npm.cmd run dev:all
```

Frontend: `http://127.0.0.1:5173/itrequest/`

API: `http://127.0.0.1:5101/itrequest/api/health`
