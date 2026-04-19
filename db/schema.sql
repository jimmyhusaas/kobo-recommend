-- Phase 0 schema for Kobo Recommend
-- Run: psql $DATABASE_URL -f db/schema.sql
-- Or:  npm run db:migrate

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  preferences jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS books_read (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  title text NOT NULL,
  author text,
  rating text CHECK (rating IN ('liked','neutral','disliked')),
  note text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS recommendations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  batch_id uuid NOT NULL,
  title text NOT NULL,
  author text,
  rationale jsonb,
  status text DEFAULT 'pending' CHECK (status IN ('pending','read','rejected','skipped')),
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS analyses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  result jsonb NOT NULL,
  book_count int,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_books_read_user ON books_read(user_id);
CREATE INDEX IF NOT EXISTS idx_recommendations_user ON recommendations(user_id);
CREATE INDEX IF NOT EXISTS idx_recommendations_batch ON recommendations(batch_id);
CREATE INDEX IF NOT EXISTS idx_analyses_user ON analyses(user_id);

-- Seed default Phase 0 user (id must match DEFAULT_USER_ID in .env.local)
INSERT INTO users (id, email, preferences)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'you@example.com',
  '{"exclude_countries": ["CN"], "exclude_languages": ["zh-Hans"]}'::jsonb
)
ON CONFLICT (email) DO NOTHING;
