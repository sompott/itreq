USE `dbps_itreq`;

ALTER TABLE `itreq_approval_slot_templates`
  MODIFY `mode` ENUM('fixed','selectable','self') NOT NULL DEFAULT 'selectable';
