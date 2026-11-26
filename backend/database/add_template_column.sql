-- =====================================================================
-- เพิ่มคอลัมน์เก็บไฟล์ Word template ของแต่ละประเภทคำขอ
-- =====================================================================

USE `dbps_itreq`;

ALTER TABLE `itreq_request_types`
  ADD COLUMN `template_file` VARCHAR(500) DEFAULT NULL COMMENT 'ไฟล์ .docx template (เก็บใน /uploads/templates)' AFTER `description`;
