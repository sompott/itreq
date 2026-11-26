-- เพิ่ม column 'kind' เพื่อแยกประเภทไฟล์แนบ:
--   request    = แนบโดยผู้ขอตอนสร้างคำขอ (default)
--   completion = แนบโดย IT staff ตอนกดเสร็จสิ้น
ALTER TABLE `itreq_attachments`
  ADD COLUMN `kind` ENUM('request','completion') NOT NULL DEFAULT 'request'
  AFTER `field_id`;
