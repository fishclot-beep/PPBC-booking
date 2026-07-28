CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS booking_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL CHECK (char_length(trim(title)) BETWEEN 1 AND 80),
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  capacity integer NOT NULL DEFAULT 0 CHECK (capacity BETWEEN 0 AND 30),
  price_type text NOT NULL CHECK (price_type IN ('private', 'per_person')),
  price_amount numeric(10, 2) NOT NULL DEFAULT 0 CHECK (price_amount >= 0),
  created_by uuid NOT NULL REFERENCES members(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at > starts_at)
);

CREATE TABLE IF NOT EXISTS session_reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES booking_sessions(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES members(id),
  seats integer NOT NULL DEFAULT 1 CHECK (seats BETWEEN 1 AND 30),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (session_id, member_id)
);

CREATE INDEX IF NOT EXISTS booking_sessions_starts_at_idx ON booking_sessions (starts_at);
CREATE INDEX IF NOT EXISTS session_reservations_session_id_idx ON session_reservations (session_id);
