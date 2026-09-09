/*
# Add user_id columns and switch RLS to owner-scoped (retry)

1. Modified Tables
- `wallet_accounts` — add `user_id uuid DEFAULT auth.uid()` referencing auth.users.
- `wallet_transactions` — add `user_id uuid DEFAULT auth.uid()` referencing auth.users.
- `wallet_goals` — add `user_id uuid DEFAULT auth.uid()` referencing auth.users.
- `wallet_settings` — add `user_id uuid DEFAULT auth.uid()`, change PK from boolean id to user_id.
2. Security Changes
- Drop all existing anon/public policies.
- Create owner-scoped RLS policies for authenticated users using auth.uid() = user_id.
3. Important Notes
- Backfill NULL user_id rows BEFORE setting NOT NULL and changing PK.
- If no auth users exist, delete old demo rows so NOT NULL and PK can be applied.
*/

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'wallet_accounts' AND column_name = 'user_id') THEN
    ALTER TABLE wallet_accounts ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'wallet_transactions' AND column_name = 'user_id') THEN
    ALTER TABLE wallet_transactions ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'wallet_goals' AND column_name = 'user_id') THEN
    ALTER TABLE wallet_goals ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'wallet_settings' AND column_name = 'user_id') THEN
    ALTER TABLE wallet_settings ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

ALTER TABLE wallet_accounts ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE wallet_transactions ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE wallet_goals ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE wallet_settings ALTER COLUMN user_id SET DEFAULT auth.uid();

-- Backfill or clean up NULL rows BEFORE applying NOT NULL / PK
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM auth.users) THEN
    UPDATE wallet_accounts SET user_id = (SELECT id FROM auth.users ORDER BY created_at LIMIT 1) WHERE user_id IS NULL;
    UPDATE wallet_transactions SET user_id = (SELECT id FROM auth.users ORDER BY created_at LIMIT 1) WHERE user_id IS NULL;
    UPDATE wallet_goals SET user_id = (SELECT id FROM auth.users ORDER BY created_at LIMIT 1) WHERE user_id IS NULL;
    UPDATE wallet_settings SET user_id = (SELECT id FROM auth.users ORDER BY created_at LIMIT 1) WHERE user_id IS NULL;
  ELSE
    DELETE FROM wallet_accounts WHERE user_id IS NULL;
    DELETE FROM wallet_transactions WHERE user_id IS NULL;
    DELETE FROM wallet_goals WHERE user_id IS NULL;
    DELETE FROM wallet_settings WHERE user_id IS NULL;
  END IF;
END $$;

-- Now safe to set NOT NULL
ALTER TABLE wallet_accounts ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE wallet_transactions ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE wallet_goals ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE wallet_settings ALTER COLUMN user_id SET NOT NULL;

-- Change wallet_settings PK from boolean id to user_id
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'wallet_settings' AND column_name = 'id') THEN
    ALTER TABLE wallet_settings DROP CONSTRAINT IF EXISTS wallet_settings_pkey;
    ALTER TABLE wallet_settings DROP COLUMN id;
    ALTER TABLE wallet_settings ADD PRIMARY KEY (user_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS wallet_accounts_user_idx ON wallet_accounts(user_id);
CREATE INDEX IF NOT EXISTS wallet_transactions_user_idx ON wallet_transactions(user_id);
CREATE INDEX IF NOT EXISTS wallet_goals_user_idx ON wallet_goals(user_id);

-- Drop old anon/public policies
DROP POLICY IF EXISTS "public read wallet accounts" ON wallet_accounts;
DROP POLICY IF EXISTS "public insert wallet accounts" ON wallet_accounts;
DROP POLICY IF EXISTS "public update wallet accounts" ON wallet_accounts;
DROP POLICY IF EXISTS "public delete wallet accounts" ON wallet_accounts;
DROP POLICY IF EXISTS "public read wallet transactions" ON wallet_transactions;
DROP POLICY IF EXISTS "public insert wallet transactions" ON wallet_transactions;
DROP POLICY IF EXISTS "public update wallet transactions" ON wallet_transactions;
DROP POLICY IF EXISTS "public delete wallet transactions" ON wallet_transactions;
DROP POLICY IF EXISTS "public read wallet goals" ON wallet_goals;
DROP POLICY IF EXISTS "public insert wallet goals" ON wallet_goals;
DROP POLICY IF EXISTS "public update wallet goals" ON wallet_goals;
DROP POLICY IF EXISTS "public delete wallet goals" ON wallet_goals;
DROP POLICY IF EXISTS "public read wallet settings" ON wallet_settings;
DROP POLICY IF EXISTS "public insert wallet settings" ON wallet_settings;
DROP POLICY IF EXISTS "public update wallet settings" ON wallet_settings;
DROP POLICY IF EXISTS "public delete wallet settings" ON wallet_settings;

-- Owner-scoped RLS policies
CREATE POLICY "select_own_accounts" ON wallet_accounts FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "insert_own_accounts" ON wallet_accounts FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "update_own_accounts" ON wallet_accounts FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "delete_own_accounts" ON wallet_accounts FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "select_own_transactions" ON wallet_transactions FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "insert_own_transactions" ON wallet_transactions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "update_own_transactions" ON wallet_transactions FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "delete_own_transactions" ON wallet_transactions FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "select_own_goals" ON wallet_goals FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "insert_own_goals" ON wallet_goals FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "update_own_goals" ON wallet_goals FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "delete_own_goals" ON wallet_goals FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "select_own_settings" ON wallet_settings FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "insert_own_settings" ON wallet_settings FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "update_own_settings" ON wallet_settings FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "delete_own_settings" ON wallet_settings FOR DELETE TO authenticated USING (auth.uid() = user_id);
