-- Additive only: no changes, deletions or sample inserts in existing app tables.
-- Private schema is NOT added to the Supabase exposed API schemas.
CREATE SCHEMA IF NOT EXISTS bn_private;
REVOKE ALL ON SCHEMA bn_private FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA bn_private TO authenticated;
CREATE TABLE IF NOT EXISTS bn_private.save_receipts (
  owner_id uuid NOT NULL,
  id text NOT NULL,
  fingerprint text NOT NULL,
  status integer NOT NULL,
  body jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (owner_id,id)
);
CREATE TABLE IF NOT EXISTS bn_private.recovery_drafts (
  owner_id uuid NOT NULL,
  id text NOT NULL,
  slot text NOT NULL,
  sequence bigint NOT NULL,
  body jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  cleared boolean NOT NULL DEFAULT false,
  PRIMARY KEY (owner_id,id)
);
CREATE INDEX IF NOT EXISTS recovery_drafts_slot ON bn_private.recovery_drafts(owner_id,slot,updated_at DESC);
CREATE TABLE IF NOT EXISTS bn_private.preferences (
  owner_id uuid NOT NULL,
  key text NOT NULL,
  value text NOT NULL,
  PRIMARY KEY (owner_id,key)
);
ALTER TABLE bn_private.save_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE bn_private.recovery_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE bn_private.preferences ENABLE ROW LEVEL SECURITY;
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['save_receipts','recovery_drafts','preferences'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='bn_private' AND tablename=t AND policyname='own_records') THEN
      EXECUTE format('CREATE POLICY own_records ON bn_private.%I FOR ALL TO authenticated USING (owner_id=auth.uid()) WITH CHECK (owner_id=auth.uid())',t);
    END IF;
    EXECUTE format('GRANT SELECT,INSERT,UPDATE,DELETE ON bn_private.%I TO authenticated',t);
    EXECUTE format('REVOKE ALL ON bn_private.%I FROM anon',t);
  END LOOP;
END $$;
