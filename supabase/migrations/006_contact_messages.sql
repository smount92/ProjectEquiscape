-- ============================================================
-- Migration 006: Contact Messages Inbox
-- Public-writable, admin-only-readable contact form submissions
-- ============================================================

-- 1. Create the contact_messages table
CREATE TABLE IF NOT EXISTS contact_messages (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  email         TEXT NOT NULL,
  subject       TEXT,
  message       TEXT NOT NULL,
  is_read       BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Enable RLS
ALTER TABLE contact_messages ENABLE ROW LEVEL SECURITY;

-- 3. Allow ANYONE (including anon / unauthenticated) to INSERT
--    This lets the public contact form work without login.
CREATE POLICY "Anyone can submit a contact message"
  ON contact_messages
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- 4. NO select / update / delete policies for anon or authenticated.
--    Only the service_role (admin/backend) can read, update, or delete rows.
--    This is the default when RLS is enabled and no policy grants access.

-- Add an index on created_at for admin inbox sorting
CREATE INDEX idx_contact_messages_created_at
  ON contact_messages (created_at DESC);

-- Add an index on is_read for filtering unread messages
CREATE INDEX idx_contact_messages_is_read
  ON contact_messages (is_read)
  WHERE is_read = FALSE;
