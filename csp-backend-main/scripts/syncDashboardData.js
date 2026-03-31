require('dotenv').config();
const fs = require('fs');
const path = require('path');
const pool = require('../src/config/db');

const dashboardSchemaSql = `
CREATE TABLE IF NOT EXISTS subscription_plans (
  id UUID PRIMARY KEY DEFAULT app_uuid(),
  plan_name VARCHAR(100) NOT NULL,
  storage_limit_gb NUMERIC(10,2) NOT NULL DEFAULT 100,
  daily_limit_gb NUMERIC(10,2) NOT NULL DEFAULT 10,
  api_limit_per_day INT NOT NULL DEFAULT 1000,
  data_transfer_limit_gb NUMERIC(10,2) NOT NULL DEFAULT 50,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS plan_name VARCHAR(100);
ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS storage_limit_gb NUMERIC(10,2) NOT NULL DEFAULT 100;
ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS daily_limit_gb NUMERIC(10,2) NOT NULL DEFAULT 10;
ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS api_limit_per_day INT NOT NULL DEFAULT 1000;
ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS data_transfer_limit_gb NUMERIC(10,2) NOT NULL DEFAULT 50;
ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
CREATE UNIQUE INDEX IF NOT EXISTS idx_subscription_plans_name ON subscription_plans(plan_name);

CREATE TABLE IF NOT EXISTS users_info (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(150) NOT NULL,
  phone VARCHAR(30),
  company_name VARCHAR(150),
  country VARCHAR(120),
  plan_id UUID REFERENCES subscription_plans(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE users_info ADD COLUMN IF NOT EXISTS name VARCHAR(150);
ALTER TABLE users_info ADD COLUMN IF NOT EXISTS phone VARCHAR(30);
ALTER TABLE users_info ADD COLUMN IF NOT EXISTS company_name VARCHAR(150);
ALTER TABLE users_info ADD COLUMN IF NOT EXISTS country VARCHAR(120);
ALTER TABLE users_info ADD COLUMN IF NOT EXISTS plan_id UUID;
ALTER TABLE users_info ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE users_info ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
CREATE INDEX IF NOT EXISTS idx_users_info_plan ON users_info(plan_id);

CREATE TABLE IF NOT EXISTS cloud_usage (
  id UUID PRIMARY KEY DEFAULT app_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  usage_date DATE NOT NULL,
  storage_used_gb NUMERIC(10,2) NOT NULL DEFAULT 0,
  current_usage_gb NUMERIC(10,2) NOT NULL DEFAULT 0,
  usage_percentage NUMERIC(6,2) NOT NULL DEFAULT 0,
  daily_limit_gb NUMERIC(10,2) NOT NULL DEFAULT 0,
  api_requests_today INT NOT NULL DEFAULT 0,
  data_transfer_today_gb NUMERIC(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE cloud_usage ADD COLUMN IF NOT EXISTS usage_date DATE;
ALTER TABLE cloud_usage ADD COLUMN IF NOT EXISTS storage_used_gb NUMERIC(10,2) NOT NULL DEFAULT 0;
ALTER TABLE cloud_usage ADD COLUMN IF NOT EXISTS current_usage_gb NUMERIC(10,2) NOT NULL DEFAULT 0;
ALTER TABLE cloud_usage ADD COLUMN IF NOT EXISTS usage_percentage NUMERIC(6,2) NOT NULL DEFAULT 0;
ALTER TABLE cloud_usage ADD COLUMN IF NOT EXISTS daily_limit_gb NUMERIC(10,2) NOT NULL DEFAULT 0;
ALTER TABLE cloud_usage ADD COLUMN IF NOT EXISTS api_requests_today INT NOT NULL DEFAULT 0;
ALTER TABLE cloud_usage ADD COLUMN IF NOT EXISTS data_transfer_today_gb NUMERIC(10,2) NOT NULL DEFAULT 0;
ALTER TABLE cloud_usage ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE cloud_usage ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
CREATE UNIQUE INDEX IF NOT EXISTS idx_cloud_usage_user_day ON cloud_usage(user_id, usage_date);
CREATE INDEX IF NOT EXISTS idx_cloud_usage_user_date ON cloud_usage(user_id, usage_date DESC);
`;

async function syncDashboardData() {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    await client.query(dashboardSchemaSql);

    const seedSql = fs.readFileSync(
      path.join(__dirname, '..', 'database', 'seed.sql'),
      'utf8'
    );

    await client.query(seedSql);
    await client.query('COMMIT');
    console.log('Dashboard schema and seed data synced successfully.');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Dashboard sync failed:', error.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

syncDashboardData();
