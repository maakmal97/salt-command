CREATE TABLE IF NOT EXISTS input_admission (
  id TEXT PRIMARY KEY,
  fingerprint TEXT NOT NULL,
  resource TEXT NOT NULL,
  amount REAL NOT NULL CHECK (amount > 0),
  snapshot TEXT NOT NULL,
  entry TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'accepted'
    CHECK (state IN ('accepted','withdrawn','rejected','committed'))
);
CREATE INDEX IF NOT EXISTS input_admission_resource ON input_admission(resource,state,snapshot);
CREATE TABLE IF NOT EXISTS input_admission_source (
  id TEXT NOT NULL REFERENCES input_admission(id),
  source TEXT NOT NULL,
  PRIMARY KEY (id,source)
);
