-- Source-only. Apply alone during an explicitly authorized vault maintenance cutover.
-- No import or authority switch occurs here. Bootstrap must install a verified legacy pair.
CREATE TABLE vault_pair (
  one INTEGER PRIMARY KEY CHECK (one=1),
  revision INTEGER NOT NULL CHECK (revision>0),
  names TEXT NOT NULL,
  places TEXT,
  updated TEXT NOT NULL,
  request_id TEXT,
  fingerprint TEXT
);
CREATE TABLE vault_receipt (
  id TEXT PRIMARY KEY,
  fingerprint TEXT NOT NULL,
  request_fingerprint TEXT,
  revision INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  operation TEXT NOT NULL CHECK (operation IN ('seed','add-id','amend-id','place'))
);
CREATE TABLE vault_outbox (
  id TEXT PRIMARY KEY REFERENCES vault_receipt(id),
  entry TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'pending' CHECK (state IN ('pending','complete')),
  completed_at TEXT,
  attempted_at TEXT NOT NULL DEFAULT ''
);
CREATE TABLE vault_maintenance (
  one INTEGER PRIMARY KEY CHECK (one=1),
  receipt_floor TEXT NOT NULL
);
INSERT INTO vault_maintenance(one,receipt_floor) VALUES (1,'');
