-- ELITE: User locations table for push notification targeting
-- Stores user push tokens and locations for earthquake warning delivery

CREATE TABLE IF NOT EXISTS user_locations (
  user_id VARCHAR(255) PRIMARY KEY,
  push_token TEXT NOT NULL,
  last_latitude DECIMAL(10, 8),
  last_longitude DECIMAL(11, 8),
  device_type VARCHAR(10) NOT NULL DEFAULT 'ios',
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_user_locations_push_token ON user_locations(push_token);
CREATE INDEX IF NOT EXISTS idx_user_locations_location ON user_locations(last_latitude, last_longitude);
CREATE INDEX IF NOT EXISTS idx_user_locations_updated_at ON user_locations(updated_at);

-- ELITE: AI predictions table
CREATE TABLE IF NOT EXISTS ai_predictions (
  event_signature VARCHAR(255) PRIMARY KEY,
  will_occur BOOLEAN NOT NULL,
  confidence INTEGER NOT NULL,
  estimated_magnitude DECIMAL(4, 2),
  time_advance INTEGER,
  probability DECIMAL(3, 2),
  factors JSONB,
  recommended_action TEXT,
  urgency VARCHAR(20),
  analyzed_at TIMESTAMP NOT NULL,
  ai_tokens_used INTEGER DEFAULT 0
);

-- ELITE: Earthquake analyses table
CREATE TABLE IF NOT EXISTS earthquake_analyses (
  earthquake_id VARCHAR(255) PRIMARY KEY,
  risk_level VARCHAR(20) NOT NULL,
  user_message TEXT NOT NULL,
  recommendations JSONB,
  verified BOOLEAN DEFAULT false,
  sources JSONB,
  confidence INTEGER NOT NULL,
  analyzed_at TIMESTAMP NOT NULL,
  ai_tokens_used INTEGER DEFAULT 0
);

