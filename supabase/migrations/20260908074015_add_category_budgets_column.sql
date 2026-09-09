/*
# Add category_budgets column to wallet_settings

1. Modified Tables
- `wallet_settings` — add `category_budgets` jsonb column to store per-category budget limits.
  Default is an empty JSON object `{}`. The frontend will read/write this as
  `{ "Food": 5000, "Bills": 8000, ... }`.
2. Security
- No policy changes. The existing owner-scoped RLS policies on wallet_settings
  already cover SELECT, INSERT, UPDATE, DELETE for the authenticated owner.
3. Important Notes
- This is additive only — no data is lost.
- The column is nullable with a default of `'{}'::jsonb` so existing rows
  automatically get an empty object.
*/

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'wallet_settings' AND column_name = 'category_budgets'
  ) THEN
    ALTER TABLE wallet_settings ADD COLUMN category_budgets jsonb NOT NULL DEFAULT '{}'::jsonb;
  END IF;
END $$;
