-- Account login status: default Active, activate existing Pending accounts.
-- Run once on each environment (local + production).

ALTER TABLE users
  MODIFY COLUMN status ENUM('Active', 'Suspended', 'Pending') NOT NULL DEFAULT 'Active';

UPDATE users
SET status = 'Active'
WHERE status = 'Pending';
