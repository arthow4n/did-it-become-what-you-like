CREATE TABLE oauth_states (
  state_hash TEXT PRIMARY KEY,
  browser_hash TEXT NOT NULL,
  pkce_verifier TEXT NOT NULL,
  handoff_challenge TEXT NOT NULL,
  return_to TEXT NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE TABLE session_handoffs (
  ticket_hash TEXT PRIMARY KEY,
  challenge TEXT NOT NULL,
  ciphertext TEXT NOT NULL,
  iv TEXT NOT NULL,
  email TEXT NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE TABLE sessions (
  session_hash TEXT PRIMARY KEY,
  ciphertext TEXT NOT NULL,
  iv TEXT NOT NULL,
  email TEXT NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE INDEX oauth_states_expiry ON oauth_states(expires_at);
CREATE INDEX session_handoffs_expiry ON session_handoffs(expires_at);
CREATE INDEX sessions_expiry ON sessions(expires_at);
