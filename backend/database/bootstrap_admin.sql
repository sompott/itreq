-- =====================================================================
-- Bootstrap admin role
-- ใส่ emp_code ของท่านลงไปเพื่อให้สามารถเข้า /admin ได้
-- =====================================================================

USE `dbps_itreq`;

-- ⚠️ แก้ '021493' เป็น emp_code ของท่าน
INSERT INTO itreq_user_roles (emp_id, role, is_active)
VALUES ('021493', 'admin', 1)
ON DUPLICATE KEY UPDATE is_active = 1;

-- ตัวอย่างเพิ่มเติม: ตั้ง IT Staff / Approver
-- INSERT INTO itreq_user_roles (emp_id, role) VALUES ('010241', 'it_staff') ON DUPLICATE KEY UPDATE is_active = 1;
-- INSERT INTO itreq_user_roles (emp_id, role) VALUES ('010882', 'approver') ON DUPLICATE KEY UPDATE is_active = 1;

SELECT * FROM itreq_user_roles;
