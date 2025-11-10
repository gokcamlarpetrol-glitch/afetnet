-- Create preparedness_plans table for centralized plan caching
-- Cost optimization: One plan per profile type shared by all users

CREATE TABLE IF NOT EXISTS preparedness_plans (
  id SERIAL PRIMARY KEY,
  profile_key VARCHAR(255) UNIQUE NOT NULL,
  profile_params JSONB NOT NULL,
  plan_data JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_preparedness_plans_profile_key ON preparedness_plans(profile_key);
CREATE INDEX IF NOT EXISTS idx_preparedness_plans_expires_at ON preparedness_plans(expires_at);

-- Add comment
COMMENT ON TABLE preparedness_plans IS 'Centralized preparedness plans cache - one plan per profile type shared by all users';

