ALTER TABLE `itreq_requests`
  MODIFY COLUMN `status`
    ENUM('draft','pending','returned','approved','rejected','in_progress','completed','closed','cancelled')
    NOT NULL DEFAULT 'draft';
