-- Emanet Merkez: sign-in only. Partners, agents, cases and money live in emanet-core.

-- A sign-in with login in progress: at most 10 minutes, used once. Only an HMAC of the cookie.
CREATE TABLE signin_tx (
  id_hash       TEXT PRIMARY KEY,
  state         TEXT NOT NULL,
  pkce_verifier TEXT NOT NULL,
  return_to     TEXT,
  second_factor INTEGER NOT NULL DEFAULT 1,
  expires_at    INTEGER NOT NULL
) STRICT;

-- Staff sessions: 2 h idle, 12 h absolute. Only an HMAC of the cookie is stored.
CREATE TABLE web_sessions (
  id_hash      TEXT PRIMARY KEY,
  uid          TEXT NOT NULL,
  created_at   INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL,
  expires_at   INTEGER NOT NULL,
  aal2_at      INTEGER
) STRICT;
CREATE INDEX web_sessions_uid ON web_sessions (uid);
