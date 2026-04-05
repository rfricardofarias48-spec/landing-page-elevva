-- Add plan_price column to profiles table
-- Allows admin to set custom pricing per user
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS plan_price NUMERIC(10, 2);

-- Set default prices for existing users based on their plan
UPDATE profiles SET plan_price = 499.90 WHERE plan = 'ESSENCIAL' AND plan_price IS NULL;
UPDATE profiles SET plan_price = 799.90 WHERE plan = 'PRO' AND plan_price IS NULL;
UPDATE profiles SET plan_price = 0 WHERE plan IN ('ENTERPRISE', 'ADMIN') AND plan_price IS NULL;
