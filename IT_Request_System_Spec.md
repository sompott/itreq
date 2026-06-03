# ระบบขอใช้งาน IT (IT Service Request System) — สรุปการออกแบบ

> เอกสารสรุปความต้องการและสถาปัตยกรรมระบบ ก่อนเริ่มพัฒนา

---

## 1. ภาพรวม (Overview)

เปลี่ยนกระบวนการขอใช้งาน IT จากเดิมที่ **เขียนใบคำขอด้วยกระดาษ** ส่งให้แผนก IT
มาเป็น **ระบบออนไลน์** ที่กรอกฟอร์ม เลือกผู้อนุมัติ และเซ็นอนุมัติได้ในระบบเลย
พร้อมแจ้งเตือนผ่านอีเมลอัตโนมัติ

### Tech Stack

| ส่วน | เทคโนโลยี |
|------|-----------|
| Frontend | React |
| Backend | Node.js |
| Database (ระบบใหม่) | MySQL |
| ระบบเดิม (Auth + ข้อมูลพนักงาน) | .NET + MySQL |
| Email | Outlook Mail ของแผนก IT (SMTP) |

---

## 2. ผู้ใช้งานในระบบ (Roles)

| Role | สิทธิ์การใช้งาน |
|------|----------------|
| ผู้ขอ (Requester) | สร้างคำขอ, กรอกฟอร์ม, เลือกผู้อนุมัติ, เซ็น, ติดตามสถานะ |
| ผู้อนุมัติ (Approver) | อนุมัติ/ปฏิเสธ, เซ็นอนุมัติ |
| เจ้าหน้าที่ IT (IT Staff) | รับงาน, ดำเนินการ, อัปเดตสถานะ, ปิดงาน |
| ผู้ดูแลระบบ (Admin) | จัดการฟอร์ม, แม่แบบช่องเซ็น, ประเภทคำขอ, รายงาน |

---

## 3. สถาปัตยกรรมระบบ (System Architecture)

```
Browser
   │ (ส่ง Cookie จากระบบ .NET เดิม)
   ▼
Nginx (Ubuntu Server)
   ├── React App (frontend)
   ├── Node.js API ──────────► Port 5101
   └── Reverse Proxy ────────► .NET (ระบบเดิม) สำหรับ verify auth
                                   │
                                   ▼
                       ┌───────────────────────┐
                       │ MySQL (ระบบเดิม)        │  ◄── query ตรง (read-only)
                       │  - รายชื่อพนักงาน        │
                       │  - แผนก                 │
                       └───────────────────────┘
                       ┌───────────────────────┐
                       │ MySQL (ระบบใหม่)        │  ◄── read/write
                       │  - requests / approvals │
                       └───────────────────────┘

ลายเซ็น/รูปพนักงาน: ดึงจาก http://www.pssugar.com/empPicture/{emp_id}.jpg
```

### หลักการเชื่อมต่อ

- React ใช้ **Cookie เดิม** ที่ระบบ .NET สร้างไว้ (ผู้ใช้ login ที่ระบบเดิมแล้ว)
- Node.js backend ทำงานที่ **port 5101** (เลี่ยงชนกับ Nginx/service อื่นบน Ubuntu)
- Reverse proxy ผ่าน Nginx ไปยัง .NET เพื่อ verify ตัวตน / ดึง session
- เข้าถึงระบบผ่าน URL รูปแบบ `http://<ip>/<ชื่อโปรแกรม>`

---

## 4. การตั้งค่า Base URL & Config

เข้าถึงผ่าน `http://<ip>/<ชื่อโปรแกรม>` (สมมติชื่อโปรแกรม = `itrequest`)

| Path | ปลายทาง |
|------|---------|
| `http://<ip>/itrequest` | React App |
| `http://<ip>/itrequest/api` | Node.js API (proxy ไป :5101) |

### Node.js Config

```javascript
const config = {
  PORT: 5101,
  APP_NAME: 'itrequest',
  BASE_PATH: '/itrequest',
  API_PREFIX: '/itrequest/api',
  EMP_PICTURE_BASE_URL: 'http://www.pssugar.com/empPicture',
};
```

### React (.env)

```
VITE_BASE_PATH = /itrequest
VITE_API_BASE_URL = /itrequest/api
VITE_EMP_PICTURE_URL = http://www.pssugar.com/empPicture
```

### Nginx

```nginx
location /itrequest/api/ {
    proxy_pass http://localhost:5101/;
}
location /itrequest/ {
    root /var/www;          # React build อยู่ที่ /var/www/itrequest
    try_files $uri $uri/ /itrequest/index.html;
}
```

> หมายเหตุ React: ตั้ง `base: '/itrequest/'` ใน `vite.config.js` และ
> `basename="/itrequest"` ใน React Router เพื่อให้ route ทำงานถูกใต้ sub-path

---

## 5. ลายเซ็น / รูปพนักงาน

รูปผูกกับ **รหัสพนักงาน** → เปลี่ยนแค่เลขไฟล์ `{emp_id}.jpg`

```
http://www.pssugar.com/empPicture/021093.jpg   (emp_id = 021093)
```

```javascript
const getEmpPicture = (empId) =>
  `${config.EMP_PICTURE_BASE_URL}/${empId}.jpg`;
```

ระบบลายเซ็นรองรับ **2 แบบ**:

1. **ดึงลายเซ็น (fetch)** — โหลดจาก URL ข้างต้น (ลายเซ็นเดิมที่มีอยู่)
2. **วาดสด (draw)** — วาดบน canvas แล้วบันทึกเป็นรูป/Base64

---

## 6. Dynamic Form Builder (ฟอร์มยืดหยุ่น)

Admin สามารถ **สร้าง/แก้ฟิลด์เองได้ผ่านหน้าจอ** โดยไม่ต้องแก้โค้ด

### ชนิดฟิลด์ที่รองรับ

| ชนิด | ใช้กับ |
|------|--------|
| text | ข้อความสั้น เช่น หัวข้อ, เบอร์ติดต่อ |
| textarea | ข้อความยาว เช่น รายละเอียด |
| dropdown / radio | ตัวเลือก เช่น ประเภทคำขอ, ความเร่งด่วน |
| checkbox | เลือกได้หลายอัน |
| date | วันที่ |
| file | แนบไฟล์ |
| signature | ลายเซ็น (วาด/ดึง) |

---

## 7. ระบบเลือกผู้อนุมัติ + เซ็น (Approval Slots)

### หลักการ

- แต่ละคำขอมีช่องเซ็น **4–5 ช่อง** (หรือมากกว่า)
- Admin กำหนดล่วงหน้าได้ว่าแต่ละช่องเป็น:
  - 🔒 **Fix** — ระบุชื่อผู้เซ็นตายตัว (ผู้ขอแก้ไม่ได้)
  - ✏️ **Selectable** — ผู้ขอใช้งานเลือกเองว่าใครเซ็น (เลือกได้ทุกคนในบริษัท)

### ตัวอย่างการตั้งค่า

| ช่อง | บทบาท | โหมด | ผู้เซ็น |
|------|-------|------|---------|
| 1 | หัวหน้าแผนก | 🔒 Fix | กำหนดตายตัว |
| 2 | ผู้จัดการฝ่าย | ✏️ ผู้ขอเลือก | เลือกตอนกรอก |
| 3 | หัวหน้า IT | 🔒 Fix | กำหนดตายตัว |
| 4 | ผู้อนุมัติงบ | ✏️ ผู้ขอเลือก | เลือกตอนกรอก |
| 5 | ผู้บริหาร | ✏️ ผู้ขอเลือก | เลือกหรือข้ามได้ |

### การส่งอีเมล

- เมื่อผู้ขอกดส่งคำขอ → ระบบ **ส่งอีเมลแจ้งผู้เซ็นทุกช่องพร้อมกัน** (ไม่ต้องรอเรียงลำดับ)
- ส่งผ่าน **Outlook Mail ของแผนก IT** เป็นผู้ส่ง

---

## 8. Workflow การทำงาน

```
Admin ตั้งแม่แบบฟอร์ม + ช่องเซ็น (ช่องไหน fix / ช่องไหนเลือกได้)
        ↓
ผู้ขอกรอกฟอร์ม
   • ช่อง fix → แสดงชื่อ (แก้ไม่ได้)
   • ช่อง selectable → ค้นหา + เลือกพนักงาน (ทุกคนในบริษัท)
        ↓
กดส่ง → ระบบสร้าง approval steps + ส่งอีเมลแจ้งผู้เซ็นทุกช่อง "พร้อมกัน"
        ↓
ผู้เซ็นแต่ละช่องเข้ามาเซ็น (วาด / ดึงลายเซ็น)
        ↓
ครบทุกช่อง (ที่บังคับ) → ส่งเข้าแผนก IT
        ↓
IT รับงาน → ดำเนินการ → ปิดงาน
```

หากช่องใดช่องหนึ่ง **ปฏิเสธ** → คำขอตีกลับไปหาผู้ขอ พร้อมเหตุผล

### สถานะคำขอ

```
ฉบับร่าง → รออนุมัติ → อนุมัติแล้ว / ปฏิเสธ
        → IT กำลังดำเนินการ → เสร็จสิ้น → ปิดงาน
```

---

## 9. โครงสร้างฐานข้อมูล (ระบบใหม่)

```sql
-- คำขอหลัก
requests (
  id, request_no, requester_emp_id, request_type_id,
  title, detail, urgency, status, created_at, updated_at
)

-- ประเภทคำขอ
request_types ( id, name, is_active )

-- นิยามฟอร์ม (Dynamic Form)
form_definitions (
  id, request_type_id, name, is_active, created_at
)

-- ฟิลด์ในแต่ละฟอร์ม
form_fields (
  id, form_id, field_label, field_name,
  field_type,        -- text / textarea / dropdown / radio / checkbox / date / file / signature
  options,           -- JSON (กรณี dropdown/radio/checkbox)
  is_required,
  sort_order,
  placeholder
)

-- ค่าที่ผู้ใช้กรอกจริง
form_values (
  id, request_id, field_id, field_value
)

-- แม่แบบช่องเซ็น (Admin ตั้งล่วงหน้า ผูกกับประเภทคำขอ)
approval_slot_templates (
  id, request_type_id,
  step_no,             -- ลำดับช่อง 1,2,3,4,5
  slot_label,          -- เช่น "หัวหน้าแผนก"
  mode,                -- 'fixed' / 'selectable'
  fixed_emp_id,        -- ใส่เมื่อ mode='fixed' (NULL เมื่อ selectable)
  is_required
)

-- ช่องเซ็นจริงของแต่ละคำขอ (สร้างตอนผู้ขอส่ง)
request_approval_steps (
  id, request_id, step_no, slot_label,
  approver_emp_id,     -- จาก fixed หรือที่ผู้ขอเลือก
  status,              -- pending / approved / rejected / skipped
  signature_type,      -- 'draw' / 'fetch'
  signature_data,      -- Base64 (วาด) หรือ URL (ดึง)
  comment, signed_at,
  email_sent_at
)

-- ไฟล์แนบ
attachments (
  id, request_id, file_name, file_path, uploaded_at
)

-- ประวัติการเปลี่ยนสถานะ
request_logs (
  id, request_id, action, actor_emp_id, note, created_at
)

-- แจ้งเตือน
notifications (
  id, recipient_emp_id, request_id, message, is_read, created_at
)
```

### ข้อมูลที่ดึงจากระบบเดิม (ไม่เก็บซ้ำ)

- รายชื่อพนักงาน + แผนก → query ตรงจาก MySQL ระบบเดิม
- ลายเซ็น/รูป → ดึงจาก URL `http://www.pssugar.com/empPicture/{emp_id}.jpg`

---

## 10. การเชื่อมต่อฐานข้อมูล (Connection Pools)

```javascript
// Pool 1: ระบบใหม่ (read/write)
const appDB = mysql.createPool({ database: 'it_request', ... });

// Pool 2: ระบบเดิม (read-only — ดึงพนักงาน)
const empDB = mysql.createPool({ database: 'company_main', ... });
```

---

## 11. ฟีเจอร์หลัก (สรุป)

- Login ผ่าน Cookie ของระบบ .NET เดิม + สิทธิ์ตาม Role
- Dynamic Form Builder (Admin สร้าง/แก้ฟิลด์เองได้)
- ช่องเซ็นยืดหยุ่น (fix / ผู้ขอเลือกได้)
- ลายเซ็นดิจิทัล 2 แบบ (วาดสด / ดึงจาก URL)
- ส่งอีเมลแจ้งผู้เซ็นทุกช่องพร้อมกัน (ผ่าน Outlook IT)
- แนบไฟล์
- ติดตามสถานะแบบ real-time
- แจ้งเตือนในระบบ + อีเมล
- Dashboard และรายงาน
- ประวัติคำขอย้อนหลัง

---

## 12. API Template Variables (สำหรับ Mail Merge ไฟล์ Word)

ทุกฟิลด์ที่สร้างใน Form Builder จะถูก export ออกมาเป็น **ตัวแปรรูปแบบ `{{ตัวแปร}}`**
ผ่าน API เพื่อนำไปวางใน template ไฟล์ Word แล้วแทนที่ด้วยค่าจริงเมื่อคำขออนุมัติเสร็จ

### หลักการ

- `field_name` ของแต่ละฟิลด์ = ชื่อตัวแปร → ใช้เป็น `{{field_name}}` ในไฟล์ Word
- ข้อมูลระบบ (รหัสคำขอ, ผู้ขอ, วันที่, ผู้เซ็น, ลายเซ็น) ก็มีตัวแปรของตัวเองด้วย
- API คืนค่าเป็น key-value พร้อมใช้แทนที่

### ตัวอย่างตัวแปรในไฟล์ Word

```
เลขที่คำขอ: {{request_no}}
ผู้ขอ: {{requester_name}}   แผนก: {{requester_department}}
วันที่: {{created_date}}

ประเภทคำขอ: {{request_type}}
หัวข้อ: {{title}}
รายละเอียด: {{detail}}

-- ฟิลด์จาก Form Builder (ตาม field_name ที่ Admin ตั้ง) --
{{phone}}
{{required_date}}
{{software_name}}

-- ช่องเซ็น (ชื่อเป็นข้อความ, ลายเซ็นเป็นรูปภาพ) --
ผู้เซ็นช่อง 1: {{approver_1_name}}   ลายเซ็น: {%approver_1_signature}
ผู้เซ็นช่อง 2: {{approver_2_name}}   ลายเซ็น: {%approver_2_signature}
```

### รูปแบบ API Response

```jsonc
// GET /itrequest/api/requests/:id/template-data
{
  "variables": {
    // ตัวแปรระบบ
    "request_no":            "REQ-2026-00123",
    "requester_name":        "สมชาย ใจดี",
    "requester_department":  "บัญชี",
    "created_date":          "03/06/2026",
    "request_type":          "ขอติดตั้งโปรแกรม",
    "title":                 "ขอติดตั้ง Photoshop",
    "detail":                "ใช้สำหรับงานออกแบบสื่อ",

    // ตัวแปรจาก Form Builder (มาจาก field_name)
    "phone":                 "1234",
    "required_date":         "10/06/2026",
    "software_name":         "Adobe Photoshop 2024",

    // ตัวแปรช่องเซ็น (วนตามจำนวน approval steps)
    // ลายเซ็น = แหล่งรูป (URL หรือ Base64) → backend แปลงเป็น Buffer แทรกเป็นรูปใน Word
    "approver_1_name":       "วิชัย หัวหน้า",
    "approver_1_signature":  "http://www.pssugar.com/empPicture/021093.jpg", // รูป (fetch)
    "approver_1_signed_at":  "04/06/2026 10:15",
    "approver_2_name":       "ประภา ผู้จัดการ",
    "approver_2_signature":  "data:image/png;base64,iVBOR...",               // รูป (draw)
    "approver_2_signed_at":  "04/06/2026 11:30"
  },
  // (ทางเลือก) คืน list ตัวแปรทั้งหมดเพื่อให้ Admin เห็นว่ามีตัวแปรอะไรใช้ได้บ้าง
  "available_placeholders": [
    "{{request_no}}", "{{requester_name}}", "{{requester_department}}",
    "{{created_date}}", "{{request_type}}", "{{title}}", "{{detail}}",
    "{{phone}}", "{{required_date}}", "{{software_name}}",
    "{{approver_1_name}}", "{%approver_1_signature}", "{{approver_1_signed_at}}",
    "{{approver_2_name}}", "{%approver_2_signature}", "{{approver_2_signed_at}}"
  ]
}
```

### การนำไปแทนที่ในไฟล์ Word (ฝั่ง Backend)

ใช้ **docxtemplater** + **image module** (`docxtemplater-image-module-free` หรือเทียบเท่า)
เพื่อแทนที่ข้อความ และ **แทรกลายเซ็นเป็นรูปภาพจริง** ในเอกสาร

```javascript
// pseudo flow
1. โหลด template.docx (มี {{ตัวแปร}} ข้อความ + {%approver_1_signature} รูป)
2. ดึง variables จาก /requests/:id/template-data
3. เตรียมรูปลายเซ็นให้เป็น Buffer:
   - signature_type = 'fetch' → ดาวน์โหลดรูปจาก URL (empPicture) → Buffer
   - signature_type = 'draw'  → แปลง Base64 → Buffer
4. docxtemplater:
   - แทนที่ {{...}} ด้วยค่าข้อความ
   - image module แทรกรูปลายเซ็นที่ตำแหน่ง {%...} ตามขนาดที่กำหนด
5. export เป็นไฟล์ .docx / .pdf ให้ดาวน์โหลด
```

### รูปแบบ placeholder ในไฟล์ Word

| ชนิด | รูปแบบใน Word | ตัวอย่าง |
|------|---------------|----------|
| ข้อความ | `{{ตัวแปร}}` | `{{requester_name}}`, `{{title}}` |
| รูปภาพ (ลายเซ็น) | `{%ตัวแปร}` | `{%approver_1_signature}`, `{%approver_2_signature}` |

> หมายเหตุ: image module ใช้ syntax `{%...}` (มีเครื่องหมาย `%`) แยกจากข้อความ `{{...}}`

```javascript
// ตัวอย่างตั้งค่าขนาดรูปลายเซ็น (px)
const imageModule = new ImageModule({
  getImage: (tagValue) => tagValue,        // Buffer ของรูป
  getSize: () => [150, 60],                // กว้าง x สูง (px) ของลายเซ็น
});
```

### การเตรียมรูปลายเซ็นเป็น Buffer

```javascript
async function getSignatureBuffer(step) {
  if (step.signature_type === 'fetch') {
    // ดึงจาก URL เช่น http://www.pssugar.com/empPicture/021093.jpg
    const res = await fetch(step.signature_data);
    return Buffer.from(await res.arrayBuffer());
  }
  // 'draw' → Base64 เช่น "data:image/png;base64,iVBOR..."
  const base64 = step.signature_data.replace(/^data:image\/\w+;base64,/, '');
  return Buffer.from(base64, 'base64');
}
```

### หมายเหตุการตั้งชื่อ field_name

- ใช้ภาษาอังกฤษ ตัวเล็ก ไม่มีช่องว่าง (เช่น `software_name` ไม่ใช่ `ชื่อโปรแกรม`)
  เพื่อให้ใช้เป็น `{{placeholder}}` ในไฟล์ Word ได้ปลอดภัย
- Form Builder ควรบังคับ/ตรวจสอบรูปแบบ `field_name` ตอน Admin สร้างฟิลด์

---

## 13. ข้อมูลที่ยังต้องยืนยันก่อนเริ่มพัฒนา

1. **ชื่อโปรแกรม** ที่จะใช้เป็น path (เช่น `itrequest`, `itservice`)
2. **Port ของระบบ .NET เดิม** + **ชื่อ Cookie** ที่ .NET ใช้ (เพื่อให้ Node อ่าน/ตรวจสอบได้)
3. **ชื่อ database เดิม** + **ตารางพนักงาน** + **คอลัมน์สำคัญ** (emp id, ชื่อ, แผนก)
4. ลิงก์ `empPicture` คือ **รูปพนักงาน** หรือ **ลายเซ็น** (ถ้าลายเซ็นอยู่คนละที่ ขอ path เพิ่ม)
5. **SMTP ของ Outlook IT** — host / port / บัญชีผู้ส่ง

---

## 14. ลำดับการพัฒนาที่เสนอ

1. วาง project structure (React + Node + โครงตาราง MySQL)
2. Auth middleware (อ่าน Cookie → verify กับ .NET → ดึงข้อมูลพนักงาน)
3. Form Builder (หน้า Admin)
4. หน้ากรอกฟอร์ม + เลือกผู้อนุมัติ + เซ็น
5. ระบบส่งอีเมล (Outlook IT)
6. Workflow อนุมัติ + ฝั่ง IT
7. Dashboard + รายงาน
