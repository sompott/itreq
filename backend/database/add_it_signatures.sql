CREATE TABLE IF NOT EXISTS itreq_request_it_signatures (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  request_id BIGINT UNSIGNED NOT NULL,
  phase ENUM('acceptance','completion') NOT NULL,
  signer_emp_id VARCHAR(20) NOT NULL,
  signature_type ENUM('draw','fetch') NOT NULL,
  signature_data LONGTEXT DEFAULT NULL,
  signature_file VARCHAR(255) DEFAULT NULL,
  comment TEXT,
  signed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_itreq_it_signature_phase (request_id, phase),
  CONSTRAINT fk_itreq_it_signature_request FOREIGN KEY (request_id)
    REFERENCES itreq_requests (id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
