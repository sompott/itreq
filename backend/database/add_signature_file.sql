-- เพิ่มคอลัมน์ signature_file สำหรับเก็บ "ชื่อไฟล์" ลายเซ็น
-- ไฟล์จริงเก็บใน IMAGE_STORAGE_PATH/signatures/
ALTER TABLE `itreq_request_approval_steps`
  ADD COLUMN `signature_file` VARCHAR(255) NULL DEFAULT NULL
  AFTER `signature_data`;
