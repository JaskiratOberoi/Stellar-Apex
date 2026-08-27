-- Public onboarding submissions — a PENDING queue, separate from employees.
-- Filled by the no-login field form (/onboard); HR reviews in the app and
-- creates the real employee record from it. Photos live OUTSIDE the web root
-- (uploads dir); only the filename is stored here.

CREATE TABLE IF NOT EXISTS onboarding_submissions (
  id                CHAR(26)      PRIMARY KEY,          -- ULID
  entity_id         VARCHAR(16)   NOT NULL DEFAULT 'noble',
  name              VARCHAR(96)   NOT NULL,
  designation       VARCHAR(16)   NOT NULL,             -- TM | ASM | RSM | ZSM
  area              VARCHAR(96)   NULL,
  location          VARCHAR(96)   NULL,
  fixed_salary      DECIMAL(12,2) NULL,
  expense_component DECIMAL(12,2) NULL,
  -- document photos, both sides required (filenames in uploads dir)
  aadhaar_front_photo VARCHAR(255) NULL,
  aadhaar_back_photo  VARCHAR(255) NULL,
  pan_front_photo     VARCHAR(255) NULL,
  pan_back_photo      VARCHAR(255) NULL,
  status            ENUM('pending','processed','rejected') NOT NULL DEFAULT 'pending',
  ip                VARCHAR(45)   NULL,
  created_at        TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
  INDEX (status, created_at),
  INDEX (ip, created_at)
);
