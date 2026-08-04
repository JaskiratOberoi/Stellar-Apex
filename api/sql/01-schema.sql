-- Stellar Apex — schema (PHP + MySQL). Import via phpMyAdmin (Hostinger) or the
-- Docker init runs it automatically. Source of truth: docs/BACKEND.md §3.

CREATE TABLE IF NOT EXISTS entities (
  id          VARCHAR(16)  PRIMARY KEY,
  name        VARCHAR(64)  NOT NULL,
  brand       VARCHAR(64)  NULL,
  legal_name  VARCHAR(128) NOT NULL,
  code        VARCHAR(8)   NOT NULL UNIQUE,
  head_office VARCHAR(64)  NULL
);

CREATE TABLE IF NOT EXISTS branches (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  entity_id      VARCHAR(16) NOT NULL,
  name           VARCHAR(64) NOT NULL,
  is_head_office TINYINT(1)  NOT NULL DEFAULT 0,
  UNIQUE (entity_id, name),
  FOREIGN KEY (entity_id) REFERENCES entities(id)
);

CREATE TABLE IF NOT EXISTS users (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  email         VARCHAR(160) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  name          VARCHAR(96)  NOT NULL,
  role          ENUM('super_admin','entity_admin','entity_hr','viewer') NOT NULL,
  entity_id     VARCHAR(16)  NULL,
  is_active     TINYINT(1)   NOT NULL DEFAULT 1,
  created_at    TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (entity_id) REFERENCES entities(id)
);

CREATE TABLE IF NOT EXISTS employees (
  id              CHAR(26)     PRIMARY KEY,
  entity_id       VARCHAR(16)  NOT NULL,
  code            VARCHAR(16)  NOT NULL,
  name            VARCHAR(96)  NOT NULL,
  photo_url       VARCHAR(255) NULL,
  gender          VARCHAR(24)  NULL,
  dob             DATE         NULL,
  blood_group     VARCHAR(4)   NULL,
  marital_status  VARCHAR(24)  NULL,
  email           VARCHAR(160) NULL,
  personal_email  VARCHAR(160) NULL,
  mobile          VARCHAR(24)  NULL,
  address_line    VARCHAR(255) NULL,
  address_city    VARCHAR(64)  NULL,
  address_state   VARCHAR(64)  NULL,
  address_pincode VARCHAR(12)  NULL,
  ec_name         VARCHAR(96)  NULL,
  ec_relation     VARCHAR(48)  NULL,
  ec_phone        VARCHAR(24)  NULL,
  designation     VARCHAR(96)  NULL,
  department      VARCHAR(64)  NULL,
  branch          VARCHAR(64)  NULL,
  employment_type VARCHAR(32)  NULL,
  work_mode       VARCHAR(32)  NULL,
  reports_to      CHAR(26)     NULL,
  status          ENUM('probation','active','notice','exited') NOT NULL DEFAULT 'probation',
  joining_date       DATE NULL,
  confirmation_date  DATE NULL,
  last_working_day   DATE NULL,
  exit_date          DATE NULL,
  aadhaar_enc      VARBINARY(255) NULL,
  pan_enc          VARBINARY(255) NULL,
  uan              VARCHAR(20)    NULL,
  esi_number       VARCHAR(20)    NULL,
  bank_account_name VARCHAR(96)   NULL,
  bank_account_enc  VARBINARY(255) NULL,
  bank_name         VARCHAR(64)   NULL,
  bank_ifsc         VARCHAR(16)   NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE (entity_id, code),
  INDEX  (entity_id, status),
  FOREIGN KEY (entity_id)  REFERENCES entities(id),
  FOREIGN KEY (reports_to) REFERENCES employees(id)
);

CREATE TABLE IF NOT EXISTS code_counters (
  entity_id VARCHAR(16) PRIMARY KEY,
  next_seq  INT NOT NULL DEFAULT 1,
  FOREIGN KEY (entity_id) REFERENCES entities(id)
);

CREATE TABLE IF NOT EXISTS audit_log (
  id          BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id     INT         NULL,
  entity_id   VARCHAR(16)  NULL,
  employee_id CHAR(26)     NULL,
  action      VARCHAR(48)  NOT NULL,
  field       VARCHAR(48)  NULL,
  detail      JSON         NULL,
  ip          VARCHAR(45)  NULL,
  created_at  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
);
