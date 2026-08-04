-- Reference data + admin accounts. Idempotent. Import after 01-schema.sql.
-- Safe for BOTH prod and dev (no demo employees here — prod ships empty).

-- Entities
INSERT INTO entities (id, name, brand, legal_name, code, head_office) VALUES
  ('noble','Noble','Qugen','Noble Diagnostics Pvt. Ltd.','NBL','Qugen (Delhi)'),
  ('ares','Ares',NULL,'Ares Healthcare Pvt. Ltd.','ARS','Head Office')
ON DUPLICATE KEY UPDATE name=VALUES(name);

INSERT INTO code_counters (entity_id, next_seq) VALUES ('noble',1),('ares',1)
ON DUPLICATE KEY UPDATE entity_id=entity_id;

-- Noble (Qugen) — 18 branches; Qugen (Delhi) is head office
INSERT INTO branches (entity_id, name, is_head_office) VALUES
  ('noble','Qugen (Delhi)',1),
  ('noble','Zirakpur',0),('noble','Khetarpal',0),('noble','Karnal',0),
  ('noble','Srinagar',0),('noble','Samarpan',0),('noble','Agra',0),
  ('noble','Rajasthan',0),('noble','Gorakhpur',0),('noble','Jhansi',0),
  ('noble','Amroha',0),('noble','Jammu',0),('noble','Lucknow',0),
  ('noble','Medsky',0),('noble','Rohtak',0),('noble','Dehradun',0),
  ('noble','Haldwani',0),('noble','Medicare',0)
ON DUPLICATE KEY UPDATE is_head_office=VALUES(is_head_office);

-- Ares — PLACEHOLDER branches; replace with the real list when provided
INSERT INTO branches (entity_id, name, is_head_office) VALUES
  ('ares','Head Office',1),('ares','Collection Centre',0)
ON DUPLICATE KEY UPDATE is_head_office=VALUES(is_head_office);

-- Admin accounts. password_hash below is bcrypt of 'Apex@1234'.
-- CHANGE THESE PASSWORDS after first login in production (see api/tools/hash.php).
INSERT INTO users (email, password_hash, name, role, entity_id) VALUES
  ('admin@stellarapex.local','$2y$10$NB4JtKdHXDXzhNX31.2Yg.flpnka84lML4vlFb0uYcOGNoFfR5DDy','Stellar Admin','super_admin',NULL),
  ('hr@noblediagnostics.in', '$2y$10$NB4JtKdHXDXzhNX31.2Yg.flpnka84lML4vlFb0uYcOGNoFfR5DDy','Noble HR','entity_admin','noble'),
  ('hr@areshealthcare.in',   '$2y$10$NB4JtKdHXDXzhNX31.2Yg.flpnka84lML4vlFb0uYcOGNoFfR5DDy','Ares HR','entity_admin','ares')
ON DUPLICATE KEY UPDATE name=VALUES(name), role=VALUES(role), entity_id=VALUES(entity_id);
