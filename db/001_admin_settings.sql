-- Run docs/booking-system-schema.sql first, then execute this file.
-- One row only: it supplies the public venue name displayed on the booking site.
CREATE TABLE IF NOT EXISTS venue_settings (
  singleton            boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  display_name         text NOT NULL CHECK (char_length(trim(display_name)) BETWEEN 1 AND 40),
  updated_by           uuid REFERENCES members(id),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

INSERT INTO venue_settings (singleton, display_name)
VALUES (true, '動力運動館')
ON CONFLICT (singleton) DO NOTHING;
