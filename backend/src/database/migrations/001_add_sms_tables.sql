-- Migration: add sms_credentials, sms_accounts, sms_transactions
CREATE TABLE IF NOT EXISTS sms_credentials (
  id SERIAL PRIMARY KEY,
  school_id INTEGER NOT NULL REFERENCES schools(school_id) ON DELETE CASCADE,
  provider VARCHAR(128) NOT NULL DEFAULT 'egosms',
  username TEXT NOT NULL,
  password TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sms_accounts (
  id SERIAL PRIMARY KEY,
  school_id INTEGER NOT NULL REFERENCES schools(school_id) ON DELETE CASCADE,
  provider_balance_bigint BIGINT DEFAULT 0,
  last_checked TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sms_transactions (
  id SERIAL PRIMARY KEY,
  school_id INTEGER NOT NULL REFERENCES schools(school_id) ON DELETE CASCADE,
  type VARCHAR(32) NOT NULL,
  amount_bigint BIGINT NOT NULL,
  details JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
