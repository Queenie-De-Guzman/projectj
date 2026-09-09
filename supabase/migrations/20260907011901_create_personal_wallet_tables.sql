/*
# Create personal wallet finance tables

1. New Tables
- `wallet_accounts` stores the user's named wallets and opening balances.
- `wallet_transactions` stores income, expense, transfer, and savings activity.
- `wallet_goals` stores savings targets and progress.
- `wallet_settings` stores the single dashboard's monthly budget and savings target.
2. Security
- Row level security is enabled on every table.
- This is a single-tenant app without sign-in, so anon and authenticated clients can use the shared workspace.
3. Important Notes
- Amounts are stored as numeric peso values.
- Transfers and savings contributions remain distinct transaction types so the UI can exclude them from expense totals.
*/

CREATE TABLE IF NOT EXISTS wallet_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  type text NOT NULL DEFAULT 'cash',
  opening_balance numeric NOT NULL DEFAULT 0,
  color text NOT NULL DEFAULT '#1d6b58',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS wallet_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid REFERENCES wallet_accounts(id) ON DELETE SET NULL,
  type text NOT NULL CHECK (type IN ('income','expense','transfer','savings')),
  amount numeric NOT NULL CHECK (amount >= 0),
  category text NOT NULL,
  description text NOT NULL,
  transaction_date date NOT NULL DEFAULT CURRENT_DATE,
  recurring boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS wallet_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  target_amount numeric NOT NULL CHECK (target_amount > 0),
  current_amount numeric NOT NULL DEFAULT 0 CHECK (current_amount >= 0),
  target_date date,
  color text NOT NULL DEFAULT '#d5a942',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS wallet_settings (
  id boolean PRIMARY KEY DEFAULT true,
  monthly_budget numeric NOT NULL DEFAULT 30000,
  savings_target numeric NOT NULL DEFAULT 20,
  currency text NOT NULL DEFAULT 'PHP',
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE wallet_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallet_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallet_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallet_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public read wallet accounts" ON wallet_accounts;
CREATE POLICY "public read wallet accounts" ON wallet_accounts FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "public insert wallet accounts" ON wallet_accounts;
CREATE POLICY "public insert wallet accounts" ON wallet_accounts FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "public update wallet accounts" ON wallet_accounts;
CREATE POLICY "public update wallet accounts" ON wallet_accounts FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "public delete wallet accounts" ON wallet_accounts;
CREATE POLICY "public delete wallet accounts" ON wallet_accounts FOR DELETE TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "public read wallet transactions" ON wallet_transactions;
CREATE POLICY "public read wallet transactions" ON wallet_transactions FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "public insert wallet transactions" ON wallet_transactions;
CREATE POLICY "public insert wallet transactions" ON wallet_transactions FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "public update wallet transactions" ON wallet_transactions;
CREATE POLICY "public update wallet transactions" ON wallet_transactions FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "public delete wallet transactions" ON wallet_transactions;
CREATE POLICY "public delete wallet transactions" ON wallet_transactions FOR DELETE TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "public read wallet goals" ON wallet_goals;
CREATE POLICY "public read wallet goals" ON wallet_goals FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "public insert wallet goals" ON wallet_goals;
CREATE POLICY "public insert wallet goals" ON wallet_goals FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "public update wallet goals" ON wallet_goals;
CREATE POLICY "public update wallet goals" ON wallet_goals FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "public delete wallet goals" ON wallet_goals;
CREATE POLICY "public delete wallet goals" ON wallet_goals FOR DELETE TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "public read wallet settings" ON wallet_settings;
CREATE POLICY "public read wallet settings" ON wallet_settings FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "public insert wallet settings" ON wallet_settings;
CREATE POLICY "public insert wallet settings" ON wallet_settings FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "public update wallet settings" ON wallet_settings;
CREATE POLICY "public update wallet settings" ON wallet_settings FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "public delete wallet settings" ON wallet_settings;
CREATE POLICY "public delete wallet settings" ON wallet_settings FOR DELETE TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS wallet_transactions_date_idx ON wallet_transactions(transaction_date DESC);
CREATE INDEX IF NOT EXISTS wallet_transactions_type_idx ON wallet_transactions(type);
