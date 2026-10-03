CREATE TABLE vault_write_gate (
  one INTEGER PRIMARY KEY CHECK (one=1),
  phase TEXT NOT NULL CHECK (phase IN ('open','draining','paused')),
  updated TEXT NOT NULL
);
INSERT INTO vault_write_gate(one,phase,updated) VALUES (1,'open','');
CREATE TABLE vault_write_active (
  id TEXT PRIMARY KEY,
  started TEXT NOT NULL
);
