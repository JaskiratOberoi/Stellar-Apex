-- Monthly attendance: one row per employee per marked day, a holiday calendar,
-- and a per-month lock that payroll depends on.
-- Status: P present, A absent, HD half day, PL paid leave, UL unpaid leave,
--         WO week off, H holiday.

CREATE TABLE IF NOT EXISTS attendance_days (
  employee_id CHAR(26)    NOT NULL,
  day         DATE        NOT NULL,
  entity_id   VARCHAR(16) NOT NULL,
  status      VARCHAR(2)  NOT NULL,
  updated_by  INT         NULL,
  updated_at  TIMESTAMP   DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (employee_id, day),
  INDEX (entity_id, day),
  FOREIGN KEY (employee_id) REFERENCES employees(id),
  FOREIGN KEY (entity_id) REFERENCES entities(id)
);

CREATE TABLE IF NOT EXISTS holidays (
  id        INT AUTO_INCREMENT PRIMARY KEY,
  entity_id VARCHAR(16) NOT NULL,
  day       DATE        NOT NULL,
  name      VARCHAR(96) NOT NULL,
  UNIQUE (entity_id, day),
  FOREIGN KEY (entity_id) REFERENCES entities(id)
);

CREATE TABLE IF NOT EXISTS attendance_months (
  entity_id VARCHAR(16) NOT NULL,
  period    CHAR(7)     NOT NULL,
  status    ENUM('open','locked') NOT NULL DEFAULT 'open',
  locked_by INT         NULL,
  locked_at DATETIME    NULL,
  PRIMARY KEY (entity_id, period),
  FOREIGN KEY (entity_id) REFERENCES entities(id)
);
