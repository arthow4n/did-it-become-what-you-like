import type { EncryptedData } from "./crypto.ts";

type StoredState = {
  pkce_verifier: string;
  handoff_challenge: string;
  return_to: string;
};

type StoredSession = EncryptedData & { email: string };

export class SessionStore {
  constructor(private readonly db: D1Database) {}

  async ready(): Promise<void> {
    await this.db.batch([
      this.db.prepare("SELECT 1 FROM oauth_states LIMIT 0"),
      this.db.prepare("SELECT 1 FROM session_handoffs LIMIT 0"),
      this.db.prepare("SELECT 1 FROM sessions LIMIT 0"),
    ]);
  }

  async saveState(
    stateHash: string,
    browserHash: string,
    state: StoredState,
    expiresAt: number,
  ): Promise<void> {
    await this.db.prepare(
      "INSERT INTO oauth_states VALUES (?, ?, ?, ?, ?, ?)",
    ).bind(
      stateHash,
      browserHash,
      state.pkce_verifier,
      state.handoff_challenge,
      state.return_to,
      expiresAt,
    ).run();
  }

  consumeState(stateHash: string, browserHash: string, now: number) {
    return this.db.prepare(
      `DELETE FROM oauth_states
       WHERE state_hash = ? AND browser_hash = ? AND expires_at > ?
       RETURNING return_to, pkce_verifier, handoff_challenge`,
    ).bind(stateHash, browserHash, now).first<StoredState>();
  }

  async saveHandoff(
    ticketHash: string,
    challenge: string,
    session: StoredSession,
    expiresAt: number,
  ): Promise<void> {
    await this.db.prepare(
      "INSERT INTO session_handoffs VALUES (?, ?, ?, ?, ?, ?)",
    ).bind(
      ticketHash,
      challenge,
      session.ciphertext,
      session.iv,
      session.email,
      expiresAt,
    )
      .run();
  }

  async establishSession(
    ticketHash: string,
    challenge: string,
    sessionHash: string,
    now: number,
    expiresAt: number,
  ): Promise<boolean> {
    // A D1 batch is a transaction. Concurrent redemptions can create only one session.
    const [created] = await this.db.batch([
      this.db.prepare(
        `INSERT INTO sessions (session_hash, ciphertext, iv, email, expires_at)
         SELECT ?, ciphertext, iv, email, ? FROM session_handoffs
         WHERE ticket_hash = ? AND challenge = ? AND expires_at > ?`,
      ).bind(sessionHash, expiresAt, ticketHash, challenge, now),
      this.db.prepare(
        `DELETE FROM session_handoffs
         WHERE ticket_hash = ? AND challenge = ? AND expires_at > ?`,
      ).bind(ticketHash, challenge, now),
    ]);
    return created.meta.changes === 1;
  }

  getSession(sessionHash: string, now: number) {
    return this.db.prepare(
      "SELECT ciphertext, iv, email FROM sessions WHERE session_hash = ? AND expires_at > ?",
    ).bind(sessionHash, now).first<StoredSession>();
  }

  async deleteSession(sessionHash: string): Promise<void> {
    await this.db.prepare("DELETE FROM sessions WHERE session_hash = ?")
      .bind(sessionHash).run();
  }

  async removeExpired(now: number): Promise<void> {
    await this.db.batch([
      this.db.prepare("DELETE FROM oauth_states WHERE expires_at <= ?").bind(
        now,
      ),
      this.db.prepare("DELETE FROM session_handoffs WHERE expires_at <= ?")
        .bind(now),
      this.db.prepare("DELETE FROM sessions WHERE expires_at <= ?").bind(now),
    ]);
  }
}
