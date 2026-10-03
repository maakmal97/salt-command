CREATE TABLE IF NOT EXISTS maker_request (
  id TEXT PRIMARY KEY,
  operation TEXT NOT NULL,
  fingerprint TEXT NOT NULL,
  response TEXT,
  entry TEXT
);
