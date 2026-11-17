-- Notepad guestbook: one row per saved visitor page.
CREATE TABLE IF NOT EXISTS notepad_pages (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at  INTEGER NOT NULL,              -- unix ms
  ip_hash     TEXT    NOT NULL,              -- sha256(salt | utc-day | ip), rate limiting only
  point_count INTEGER NOT NULL,
  data        TEXT    NOT NULL               -- validated, re-serialised stroke JSON (v1)
);
CREATE INDEX IF NOT EXISTS idx_notepad_pages_ip_time ON notepad_pages (ip_hash, created_at);
CREATE INDEX IF NOT EXISTS idx_notepad_pages_time    ON notepad_pages (created_at);
