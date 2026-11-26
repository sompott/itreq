CREATE TABLE IF NOT EXISTS `itreq_settings` (
  `setting_key` VARCHAR(100) NOT NULL,
  `setting_value` JSON NOT NULL,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`setting_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `itreq_settings` (`setting_key`, `setting_value`)
VALUES (
  'request_no_config',
  JSON_OBJECT(
    'mode', 'legacy',
    'pattern', 'REQ-{BYYYY}-{SEQ}',
    'sequence_digits', 3,
    'reset_period', 'year'
  )
)
ON DUPLICATE KEY UPDATE `setting_value` = `setting_value`;

CREATE TABLE IF NOT EXISTS `itreq_request_no_configs` (
  `request_type_id` INT UNSIGNED NOT NULL,
  `mode` ENUM('legacy','custom') NOT NULL DEFAULT 'legacy',
  `pattern` VARCHAR(100) NOT NULL DEFAULT 'REQ-{BYYYY}-{SEQ}',
  `sequence_digits` TINYINT UNSIGNED NOT NULL DEFAULT 3,
  `reset_period` ENUM('month','year','never') NOT NULL DEFAULT 'year',
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`request_type_id`),
  CONSTRAINT `fk_itreq_request_no_configs_type`
    FOREIGN KEY (`request_type_id`) REFERENCES `itreq_request_types` (`id`)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

UPDATE `itreq_settings`
   SET `setting_value` = JSON_SET(`setting_value`, '$.pattern', 'REQ-{BYYYY}-{SEQ}')
 WHERE `setting_key` = 'request_no_config'
   AND JSON_UNQUOTE(JSON_EXTRACT(`setting_value`, '$.mode')) = 'legacy';

UPDATE `itreq_request_no_configs`
   SET `pattern` = 'REQ-{BYYYY}-{SEQ}'
 WHERE `mode` = 'legacy';
