-- =====================================================================
-- IT Request System - Database Schema (MySQL / MariaDB)
-- Database: dbps_keng
-- Prefix:   itreq_
-- Charset:  utf8mb4 (รองรับภาษาไทย + emoji)
-- Engine:   InnoDB (รองรับ Foreign Key + Transaction)
-- =====================================================================

CREATE DATABASE IF NOT EXISTS `dbps_itreq`
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_unicode_ci;

USE `dbps_itreq`;

-- ---------------------------------------------------------------------
-- 1) ประเภทคำขอ (Request Types)
-- ---------------------------------------------------------------------
CREATE TABLE `itreq_request_types` (
  `id`         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `name`       VARCHAR(150) NOT NULL COMMENT 'ชื่อประเภทคำขอ เช่น ขอติดตั้งโปรแกรม',
  `description` VARCHAR(500) DEFAULT NULL,
  `is_active`  TINYINT(1) NOT NULL DEFAULT 1,
  `sort_order` INT NOT NULL DEFAULT 0,
  `it_acceptance_required` TINYINT(1) NOT NULL DEFAULT 0,
  `it_completion_required` TINYINT(1) NOT NULL DEFAULT 0,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_itreq_request_types_active` (`is_active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- 2) คำขอหลัก (Requests)
-- ---------------------------------------------------------------------
CREATE TABLE `itreq_requests` (
  `id`               BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `request_no`       VARCHAR(30) NOT NULL COMMENT 'เลขที่คำขอ เช่น REQ-2026-00123',
  `requester_emp_id` VARCHAR(20) NOT NULL COMMENT 'รหัสพนักงานผู้ขอ (จากระบบเดิม)',
  `request_type_id`  INT UNSIGNED NOT NULL,
  `title`            VARCHAR(255) NOT NULL,
  `detail`           TEXT,
  `urgency`          ENUM('low','normal','high','urgent') NOT NULL DEFAULT 'normal',
  `status`           ENUM('draft','pending','returned','approved','rejected','in_progress','completed','closed','cancelled')
                       NOT NULL DEFAULT 'draft',
  `submitted_at`     DATETIME DEFAULT NULL COMMENT 'เวลาที่กดส่งคำขอ',
  `completed_at`     DATETIME DEFAULT NULL,
  `closed_at`        DATETIME DEFAULT NULL,
  `created_at`       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_itreq_requests_request_no` (`request_no`),
  KEY `idx_itreq_requests_requester` (`requester_emp_id`),
  KEY `idx_itreq_requests_type` (`request_type_id`),
  KEY `idx_itreq_requests_status` (`status`),
  KEY `idx_itreq_requests_created` (`created_at`),
  CONSTRAINT `fk_itreq_requests_type`
    FOREIGN KEY (`request_type_id`) REFERENCES `itreq_request_types` (`id`)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- 3) นิยามฟอร์ม (Form Definitions) - Dynamic Form
-- ---------------------------------------------------------------------
CREATE TABLE `itreq_form_definitions` (
  `id`              INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `request_type_id` INT UNSIGNED NOT NULL,
  `name`            VARCHAR(150) NOT NULL,
  `version`         INT NOT NULL DEFAULT 1,
  `is_active`       TINYINT(1) NOT NULL DEFAULT 1,
  `created_by`      VARCHAR(20) DEFAULT NULL COMMENT 'รหัสพนักงานผู้สร้าง',
  `created_at`      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_itreq_form_def_type` (`request_type_id`),
  KEY `idx_itreq_form_def_active` (`is_active`),
  CONSTRAINT `fk_itreq_form_def_type`
    FOREIGN KEY (`request_type_id`) REFERENCES `itreq_request_types` (`id`)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- 4) ฟิลด์ในฟอร์ม (Form Fields)
-- ---------------------------------------------------------------------
CREATE TABLE `itreq_form_fields` (
  `id`           INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `form_id`      INT UNSIGNED NOT NULL,
  `field_label`  VARCHAR(255) NOT NULL COMMENT 'ป้ายชื่อฟิลด์ที่แสดงให้ผู้ใช้เห็น',
  `field_name`   VARCHAR(100) NOT NULL COMMENT 'ชื่อตัวแปร (a-z, 0-9, _) ใช้เป็น {{placeholder}} ใน Word',
  `field_type`   ENUM('text','textarea','dropdown','radio','checkbox','date','file','signature','number','email')
                   NOT NULL,
  `options`      JSON DEFAULT NULL COMMENT 'ตัวเลือก (dropdown/radio/checkbox)',
  `placeholder`  VARCHAR(255) DEFAULT NULL,
  `default_value` VARCHAR(500) DEFAULT NULL,
  `is_required`  TINYINT(1) NOT NULL DEFAULT 0,
  `sort_order`   INT NOT NULL DEFAULT 0,
  `validation`   JSON DEFAULT NULL COMMENT 'กฎตรวจสอบเพิ่ม เช่น min/max/regex',
  `created_at`   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_itreq_form_field_name` (`form_id`,`field_name`),
  KEY `idx_itreq_form_fields_form` (`form_id`,`sort_order`),
  CONSTRAINT `fk_itreq_form_fields_form`
    FOREIGN KEY (`form_id`) REFERENCES `itreq_form_definitions` (`id`)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- 5) ค่าที่ผู้ใช้กรอก (Form Values)
-- ---------------------------------------------------------------------
CREATE TABLE `itreq_form_values` (
  `id`          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `request_id`  BIGINT UNSIGNED NOT NULL,
  `field_id`    INT UNSIGNED NOT NULL,
  `field_value` LONGTEXT COMMENT 'ค่าที่กรอก (เก็บเป็น text สำหรับทุกประเภท / JSON สำหรับ multi-select)',
  `created_at`  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_itreq_form_values_request_field` (`request_id`,`field_id`),
  KEY `idx_itreq_form_values_field` (`field_id`),
  CONSTRAINT `fk_itreq_form_values_request`
    FOREIGN KEY (`request_id`) REFERENCES `itreq_requests` (`id`)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT `fk_itreq_form_values_field`
    FOREIGN KEY (`field_id`) REFERENCES `itreq_form_fields` (`id`)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- 6) แม่แบบช่องเซ็น (Approval Slot Templates)
-- ---------------------------------------------------------------------
CREATE TABLE `itreq_approval_slot_templates` (
  `id`              INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `request_type_id` INT UNSIGNED NOT NULL,
  `step_no`         TINYINT UNSIGNED NOT NULL COMMENT 'ลำดับช่อง 1,2,3,4,5',
  `slot_label`      VARCHAR(150) NOT NULL COMMENT 'เช่น หัวหน้าแผนก, ผู้จัดการฝ่าย',
  `mode`            ENUM('fixed','selectable','self','it_staff') NOT NULL DEFAULT 'selectable',
  `sign_stage`      ENUM('approval','acceptance','completion') NOT NULL DEFAULT 'approval',
  `fixed_emp_id`    VARCHAR(20) DEFAULT NULL COMMENT 'รหัสพนักงาน (เฉพาะ mode=fixed)',
  `is_required`     TINYINT(1) NOT NULL DEFAULT 1,
  `allow_skip`      TINYINT(1) NOT NULL DEFAULT 0,
  `created_at`      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_itreq_slot_tmpl_type_step` (`request_type_id`,`step_no`),
  CONSTRAINT `fk_itreq_slot_tmpl_type`
    FOREIGN KEY (`request_type_id`) REFERENCES `itreq_request_types` (`id`)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- 7) ช่องเซ็นจริงของแต่ละคำขอ (Request Approval Steps)
-- ---------------------------------------------------------------------
CREATE TABLE `itreq_request_approval_steps` (
  `id`              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `request_id`      BIGINT UNSIGNED NOT NULL,
  `step_no`         TINYINT UNSIGNED NOT NULL,
  `slot_label`      VARCHAR(150) NOT NULL,
  `approver_emp_id` VARCHAR(20) DEFAULT NULL COMMENT 'รหัสพนักงานผู้เซ็น หรือ NULL สำหรับเจ้าหน้าที่ IT ที่รับงาน',
  `sign_stage` ENUM('approval','acceptance','completion') NOT NULL DEFAULT 'approval',
  `signer_mode` ENUM('fixed','selectable','self','it_staff') NOT NULL DEFAULT 'fixed',
  `status`          ENUM('pending','approved','rejected','skipped') NOT NULL DEFAULT 'pending',
  `signature_type`  ENUM('draw','fetch') DEFAULT NULL,
  `signature_data`  LONGTEXT DEFAULT NULL COMMENT 'Base64 (draw) หรือ URL (fetch)',
  `comment`         TEXT,
  `signed_at`       DATETIME DEFAULT NULL,
  `email_sent_at`   DATETIME DEFAULT NULL,
  `created_at`      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_itreq_approval_request_step` (`request_id`,`step_no`),
  KEY `idx_itreq_approval_approver` (`approver_emp_id`),
  KEY `idx_itreq_approval_status` (`status`),
  CONSTRAINT `fk_itreq_approval_request`
    FOREIGN KEY (`request_id`) REFERENCES `itreq_requests` (`id`)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- 7.1) ลายเซ็น IT หลังอนุมัติ
-- ---------------------------------------------------------------------
CREATE TABLE `itreq_request_it_signatures` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `request_id` BIGINT UNSIGNED NOT NULL,
  `phase` ENUM('acceptance','completion') NOT NULL,
  `signer_emp_id` VARCHAR(20) NOT NULL,
  `signature_type` ENUM('draw','fetch') NOT NULL,
  `signature_data` LONGTEXT DEFAULT NULL,
  `signature_file` VARCHAR(255) DEFAULT NULL,
  `comment` TEXT,
  `signed_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY `uk_itreq_it_signature_phase` (`request_id`,`phase`),
  CONSTRAINT `fk_itreq_it_signature_request` FOREIGN KEY (`request_id`)
    REFERENCES `itreq_requests` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- 8) ไฟล์แนบ (Attachments)
-- ---------------------------------------------------------------------
CREATE TABLE `itreq_attachments` (
  `id`           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `request_id`   BIGINT UNSIGNED NOT NULL,
  `field_id`     INT UNSIGNED DEFAULT NULL COMMENT 'ผูกกับ form_field (กรณี field_type=file)',
  `file_name`    VARCHAR(255) NOT NULL COMMENT 'ชื่อไฟล์ต้นฉบับ',
  `file_path`    VARCHAR(500) NOT NULL COMMENT 'path บน server',
  `file_size`    BIGINT UNSIGNED DEFAULT NULL COMMENT 'ขนาดไฟล์ (bytes)',
  `mime_type`    VARCHAR(100) DEFAULT NULL,
  `uploaded_by`  VARCHAR(20) DEFAULT NULL,
  `uploaded_at`  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_itreq_attachments_request` (`request_id`),
  KEY `idx_itreq_attachments_field` (`field_id`),
  CONSTRAINT `fk_itreq_attachments_request`
    FOREIGN KEY (`request_id`) REFERENCES `itreq_requests` (`id`)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT `fk_itreq_attachments_field`
    FOREIGN KEY (`field_id`) REFERENCES `itreq_form_fields` (`id`)
    ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- 9) ประวัติการเปลี่ยนสถานะ (Request Logs)
-- ---------------------------------------------------------------------
CREATE TABLE `itreq_request_logs` (
  `id`           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `request_id`   BIGINT UNSIGNED NOT NULL,
  `action`       VARCHAR(50) NOT NULL COMMENT 'submit, approve, reject, assign, complete, close, ...',
  `actor_emp_id` VARCHAR(20) DEFAULT NULL,
  `from_status`  VARCHAR(30) DEFAULT NULL,
  `to_status`    VARCHAR(30) DEFAULT NULL,
  `note`         TEXT,
  `created_at`   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_itreq_logs_request` (`request_id`),
  KEY `idx_itreq_logs_actor` (`actor_emp_id`),
  KEY `idx_itreq_logs_created` (`created_at`),
  CONSTRAINT `fk_itreq_logs_request`
    FOREIGN KEY (`request_id`) REFERENCES `itreq_requests` (`id`)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- 10) แจ้งเตือน (Notifications)
-- ---------------------------------------------------------------------
CREATE TABLE `itreq_notifications` (
  `id`               BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `recipient_emp_id` VARCHAR(20) NOT NULL,
  `request_id`       BIGINT UNSIGNED DEFAULT NULL,
  `type`             VARCHAR(50) DEFAULT NULL COMMENT 'approval_required / status_change / comment / ...',
  `title`            VARCHAR(255) DEFAULT NULL,
  `message`          TEXT NOT NULL,
  `link_url`         VARCHAR(500) DEFAULT NULL,
  `is_read`          TINYINT(1) NOT NULL DEFAULT 0,
  `read_at`          DATETIME DEFAULT NULL,
  `created_at`       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_itreq_notif_recipient` (`recipient_emp_id`,`is_read`),
  KEY `idx_itreq_notif_request` (`request_id`),
  KEY `idx_itreq_notif_created` (`created_at`),
  CONSTRAINT `fk_itreq_notif_request`
    FOREIGN KEY (`request_id`) REFERENCES `itreq_requests` (`id`)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- 11) สิทธิ์ผู้ใช้งานในระบบ (User Roles)
--     เก็บแยกจากระบบเดิม (ระบบเดิมเก็บแค่ข้อมูลพนักงาน)
-- ---------------------------------------------------------------------
CREATE TABLE `itreq_user_roles` (
  `id`         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `emp_id`     VARCHAR(20) NOT NULL,
  `role`       ENUM('requester','approver','it_staff','admin') NOT NULL DEFAULT 'requester',
  `is_active`  TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_itreq_user_roles_emp_role` (`emp_id`,`role`),
  KEY `idx_itreq_user_roles_role` (`role`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================================
-- Seed Data ตัวอย่าง (ลบออกได้ถ้าไม่ต้องการ)
-- =====================================================================

INSERT INTO `itreq_request_types` (`name`, `description`, `sort_order`) VALUES
  ('ขอติดตั้งโปรแกรม',  'ขอติดตั้งซอฟต์แวร์บนเครื่องคอมพิวเตอร์', 1),
  ('ขอใช้งานอีเมล',     'ขอเปิดบัญชีอีเมลของบริษัท',           2),
  ('แจ้งซ่อมอุปกรณ์',   'แจ้งซ่อม PC / Printer / Network',     3),
  ('ขอสิทธิ์เข้าระบบ',  'ขอสิทธิ์เข้าใช้งานระบบภายใน',         4);
