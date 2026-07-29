import postgres, { type Sql } from "postgres";

declare global {
  var sportsBookingSql: Sql | undefined;
}

/** Opens one server-only PostgreSQL client, after DATABASE_URL has been configured. */
export function db(): Sql {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not configured. Copy .env.example to .env.local and set it first.");
  }

  if (!global.sportsBookingSql) {
    const isLocalConnection = /(localhost|127\.0\.0\.1|\[::1\])/.test(connectionString);
    global.sportsBookingSql = postgres(connectionString, {
      // Never use a plaintext connection outside localhost. DATABASE_SSL=false is accepted only for local development.
      ssl: !isLocalConnection && process.env.DATABASE_SSL !== "false" ? "require" : false,
      max: 10,
      idle_timeout: 20,
    });
  }
  return global.sportsBookingSql;
}

let sessionSchemaReady: Promise<void> | undefined;
export function ensureSessionSchema() {
  if (!sessionSchemaReady) sessionSchemaReady = (async () => {
    const sql = db();
    await sql`CREATE EXTENSION IF NOT EXISTS pgcrypto`;
    await sql`CREATE TABLE IF NOT EXISTS booking_sessions (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), title text NOT NULL, starts_at timestamptz NOT NULL, ends_at timestamptz NOT NULL, capacity integer NOT NULL DEFAULT 0 CHECK (capacity BETWEEN 0 AND 30), price_type text NOT NULL CHECK (price_type IN ('private', 'per_person')), price_amount numeric(10,2) NOT NULL DEFAULT 0 CHECK (price_amount >= 0), created_by uuid NOT NULL REFERENCES members(id), created_at timestamptz NOT NULL DEFAULT now(), CHECK (ends_at > starts_at))`;
    await sql`ALTER TABLE booking_sessions ADD COLUMN IF NOT EXISTS actual_collected numeric(10,2)`;
    await sql`ALTER TABLE booking_sessions ADD COLUMN IF NOT EXISTS closed_at timestamptz`;
    await sql`ALTER TABLE booking_sessions ADD COLUMN IF NOT EXISTS closed_by uuid REFERENCES members(id)`;
    await sql`CREATE TABLE IF NOT EXISTS session_reservations (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), session_id uuid NOT NULL REFERENCES booking_sessions(id) ON DELETE CASCADE, member_id uuid NOT NULL REFERENCES members(id), seats integer NOT NULL DEFAULT 1 CHECK (seats BETWEEN 1 AND 30), created_at timestamptz NOT NULL DEFAULT now(), UNIQUE (session_id, member_id))`;
  })();
  return sessionSchemaReady;
}
