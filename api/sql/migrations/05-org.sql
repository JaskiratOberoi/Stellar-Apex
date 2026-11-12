-- Organisation structure masters: departments, designations, richer branches,
-- and per-entity settings. Employees keep referring to these by name.

CREATE TABLE IF NOT EXISTS departments (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  entity_id        VARCHAR(16) NOT NULL,
  name             VARCHAR(64) NOT NULL,
  head_employee_id CHAR(26)    NULL,
  is_active        TINYINT(1)  NOT NULL DEFAULT 1,
  UNIQUE (entity_id, name),
  FOREIGN KEY (entity_id) REFERENCES entities(id),
  FOREIGN KEY (head_employee_id) REFERENCES employees(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS designations (
  id        INT AUTO_INCREMENT PRIMARY KEY,
  entity_id VARCHAR(16) NOT NULL,
  name      VARCHAR(96) NOT NULL,
  level     INT         NOT NULL DEFAULT 5,
  is_active TINYINT(1)  NOT NULL DEFAULT 1,
  UNIQUE (entity_id, name),
  FOREIGN KEY (entity_id) REFERENCES entities(id)
);

ALTER TABLE branches
  ADD COLUMN type VARCHAR(24) NOT NULL DEFAULT 'branch',
  ADD COLUMN city VARCHAR(64) NULL,
  ADD COLUMN state VARCHAR(64) NULL,
  ADD COLUMN manager_employee_id CHAR(26) NULL,
  ADD COLUMN is_active TINYINT(1) NOT NULL DEFAULT 1;

UPDATE branches SET type = 'head_office' WHERE is_head_office = 1;
UPDATE branches SET type = 'collection_centre' WHERE name = 'Collection Centre';
UPDATE branches SET city = 'Delhi', state = 'Delhi' WHERE entity_id = 'noble' AND name = 'Qugen (Delhi)';

INSERT IGNORE INTO departments (entity_id, name)
SELECT e.id, d.name FROM entities e CROSS JOIN (
  SELECT 'Lab Operations' AS name UNION ALL SELECT 'Phlebotomy' UNION ALL SELECT 'Pathology'
  UNION ALL SELECT 'Radiology' UNION ALL SELECT 'Front Office' UNION ALL SELECT 'Customer Support'
  UNION ALL SELECT 'Sales & Marketing' UNION ALL SELECT 'Finance & Accounts'
  UNION ALL SELECT 'Human Resources' UNION ALL SELECT 'IT & Systems' UNION ALL SELECT 'Logistics'
  UNION ALL SELECT 'Admin & Facilities'
) d;

INSERT IGNORE INTO departments (entity_id, name)
SELECT DISTINCT entity_id, department FROM employees WHERE department IS NOT NULL AND department <> '';

INSERT IGNORE INTO designations (entity_id, name)
SELECT DISTINCT entity_id, designation FROM employees WHERE designation IS NOT NULL AND designation <> '';

CREATE TABLE IF NOT EXISTS entity_settings (
  entity_id  VARCHAR(16) PRIMARY KEY,
  settings   JSON NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (entity_id) REFERENCES entities(id)
);
