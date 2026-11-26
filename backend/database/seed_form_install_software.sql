-- =====================================================================
-- ตัวอย่างการสร้างฟอร์ม 1 ชุด: "ขอติดตั้งโปรแกรม"
--
-- ครอบคลุม 4 ตารางที่ต้องใส่พร้อมกัน:
--   1) itreq_request_types          → ประเภทคำขอ
--   2) itreq_form_definitions       → นิยามฟอร์ม (1 type สามารถมีหลาย version)
--   3) itreq_form_fields            → ฟิลด์ในฟอร์ม
--   4) itreq_approval_slot_templates → แม่แบบช่องเซ็น (4-5 ช่อง)
--
-- ⚠️ แก้ค่าก่อนรัน:
--   - fixed_emp_id ต้องเปลี่ยนเป็น emp_code จริง (เช่น '021093')
-- =====================================================================

USE `dbps_itreq`;

-- ลบของเดิม (ถ้าทดลองรันซ้ำ)
-- DELETE FROM itreq_approval_slot_templates WHERE request_type_id = 1;
-- DELETE FROM itreq_form_fields WHERE form_id IN (SELECT id FROM itreq_form_definitions WHERE request_type_id = 1);
-- DELETE FROM itreq_form_definitions WHERE request_type_id = 1;

-- ─────────────────────────────────────────────────────────────────────
-- 1) ประเภทคำขอ (ใส่ไว้แล้วใน schema.sql — INSERT IGNORE กันซ้ำ)
-- ─────────────────────────────────────────────────────────────────────
INSERT IGNORE INTO itreq_request_types (id, name, description, sort_order, is_active)
VALUES (1, 'ขอติดตั้งโปรแกรม', 'ขอติดตั้งซอฟต์แวร์บนเครื่องคอมพิวเตอร์', 1, 1);

-- ─────────────────────────────────────────────────────────────────────
-- 2) นิยามฟอร์ม
-- ─────────────────────────────────────────────────────────────────────
INSERT INTO itreq_form_definitions
  (id, request_type_id, name, version, is_active, created_by)
VALUES
  (1, 1, 'แบบฟอร์มขอติดตั้งโปรแกรม', 1, 1, NULL);

-- ─────────────────────────────────────────────────────────────────────
-- 3) ฟิลด์ในฟอร์ม
--    field_name → ใช้เป็น {{placeholder}} ใน Word ต้องเป็น a-z, 0-9, _
-- ─────────────────────────────────────────────────────────────────────
INSERT INTO itreq_form_fields
  (form_id, field_label,        field_name,      field_type, options, placeholder,                     is_required, sort_order)
VALUES
  (1, 'หัวข้อ',                  'title',         'text',     NULL,    'เช่น ขอติดตั้ง Photoshop',          1, 1),
  (1, 'รายละเอียด',              'detail',        'textarea', NULL,    'ระบุเหตุผลและเครื่องที่ติดตั้ง',     1, 2),
  (1, 'ชื่อโปรแกรม',             'software_name', 'text',     NULL,    'Adobe Photoshop 2024',           1, 3),
  (1, 'เวอร์ชัน',                'software_version','text',   NULL,    '2024 / 2025',                   0, 4),
  (1, 'วันที่ต้องการใช้งาน',      'required_date', 'date',     NULL,    NULL,                             0, 5),
  (1, 'เบอร์ติดต่อภายใน',         'phone',         'text',     NULL,    '1234',                           1, 6),
  (1, 'ประเภทเครื่อง',            'device_type',   'dropdown',
       JSON_ARRAY('PC สำนักงาน','Notebook','Server','อื่น ๆ'),
       NULL, 1, 7),
  (1, 'เหตุผล/วัตถุประสงค์',     'purpose',       'textarea', NULL,    'ใช้กับงานออกแบบ ฯลฯ',             0, 8);

-- ─────────────────────────────────────────────────────────────────────
-- 4) แม่แบบช่องเซ็น (5 ช่อง: 2 fix + 3 selectable)
--    fixed_emp_id: ใส่ emp_code จริง (varchar) เช่น '021093', '010241'
-- ─────────────────────────────────────────────────────────────────────
INSERT INTO itreq_approval_slot_templates
  (request_type_id, step_no, slot_label,           mode,         fixed_emp_id, is_required, allow_skip)
VALUES
  (1,               1,       'หัวหน้าแผนก',         'fixed',      '021093',     1,           0),
  (1,               2,       'ผู้จัดการฝ่าย',        'selectable', NULL,         1,           0),
  (1,               3,       'หัวหน้าแผนก IT',      'fixed',      '021093',     1,           0),
  (1,               4,       'ผู้อนุมัติงบประมาณ',   'selectable', NULL,         1,           0),
  (1,               5,       'ผู้บริหาร',           'selectable', NULL,         0,           1);

-- =====================================================================
-- เสร็จ — เปิดเว็บ refresh → เลือก "ขอติดตั้งโปรแกรม" → ฟิลด์ + ช่องเซ็นจะแสดงครบ
-- =====================================================================
