-- Disbursal: how and whether each salary line was paid. A batch groups the
-- lines paid together (one bank upload, one cash payout).

CREATE TABLE IF NOT EXISTS disbursal_batches (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  run_id     INT          NOT NULL,
  entity_id  VARCHAR(16)  NOT NULL,
  paid_on    DATE         NOT NULL,
  reference  VARCHAR(96)  NULL,
  note       VARCHAR(255) NULL,
  line_count INT          NOT NULL DEFAULT 0,
  amount     DECIMAL(14,2) NOT NULL DEFAULT 0,
  created_by INT          NULL,
  created_at TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (run_id) REFERENCES payroll_runs(id) ON DELETE CASCADE
);

ALTER TABLE payroll_lines
  ADD COLUMN pay_mode ENUM('bank','cash','cheque') NOT NULL DEFAULT 'bank',
  ADD COLUMN payout_status ENUM('pending','held','paid') NOT NULL DEFAULT 'pending',
  ADD COLUMN hold_reason VARCHAR(255) NULL,
  ADD COLUMN paid_on DATE NULL,
  ADD COLUMN payment_ref VARCHAR(96) NULL,
  ADD COLUMN batch_id INT NULL,
  ADD COLUMN paid_account_name VARCHAR(96) NULL,
  ADD COLUMN paid_bank_name VARCHAR(64) NULL,
  ADD COLUMN paid_ifsc VARCHAR(16) NULL,
  ADD COLUMN paid_account_enc VARBINARY(255) NULL;
