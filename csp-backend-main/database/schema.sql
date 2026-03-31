-- =====================================================
-- EXTENSIONS
-- =====================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- UNIVERSAL UUID GENERATOR
-- =====================================================

CREATE OR REPLACE FUNCTION app_uuid()
    RETURNS UUID AS $$
BEGIN
    RETURN gen_random_uuid();
EXCEPTION
    WHEN undefined_function THEN
        RETURN uuid_generate_v4();
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- EMAIL NORMALIZATION
-- =====================================================

CREATE OR REPLACE FUNCTION normalize_email()
    RETURNS TRIGGER AS $$
BEGIN
    NEW.email = lower(NEW.email);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- AUTO UPDATED_AT FUNCTION
-- =====================================================

CREATE OR REPLACE FUNCTION set_updated_at()
    RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- USERS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS users (

                                     id UUID PRIMARY KEY DEFAULT app_uuid(),

                                     email VARCHAR(255) UNIQUE NOT NULL,
                                     password_hash TEXT NOT NULL,

                                     role VARCHAR(20) NOT NULL
                                         CHECK (role IN ('user','admin')),

                                     is_active BOOLEAN NOT NULL DEFAULT TRUE,
                                     email_verified BOOLEAN NOT NULL DEFAULT FALSE,

                                     created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                                     updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

                                     CONSTRAINT users_email_lowercase_chk
                                         CHECK (email = lower(email)),

                                     CONSTRAINT users_email_format_chk
                                         CHECK (
                                             email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'
                                             ),

                                     CONSTRAINT users_password_hash_nonempty_chk
                                         CHECK (length(password_hash) > 0)
);

CREATE INDEX IF NOT EXISTS idx_users_email
    ON users(email);

CREATE TRIGGER users_email_normalize
    BEFORE INSERT OR UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION normalize_email();

CREATE TRIGGER users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =====================================================
-- SUBSCRIPTION PLANS
-- =====================================================

CREATE TABLE IF NOT EXISTS subscription_plans (

                                                   id UUID PRIMARY KEY DEFAULT app_uuid(),

                                                   plan_name VARCHAR(100) NOT NULL UNIQUE,
                                                   storage_limit_gb NUMERIC(10,2) NOT NULL DEFAULT 100,
                                                   daily_limit_gb NUMERIC(10,2) NOT NULL DEFAULT 10,
                                                   api_limit_per_day INT NOT NULL DEFAULT 1000,
                                                   data_transfer_limit_gb NUMERIC(10,2) NOT NULL DEFAULT 50,

                                                   created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                                                   updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER subscription_plans_updated_at
    BEFORE UPDATE ON subscription_plans
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =====================================================
-- USER PROFILE
-- =====================================================

CREATE TABLE IF NOT EXISTS users_info (

                                         user_id UUID PRIMARY KEY
                                             REFERENCES users(id) ON DELETE CASCADE,

                                         name VARCHAR(150) NOT NULL,
                                         phone VARCHAR(30),
                                         company_name VARCHAR(150),
                                         country VARCHAR(120),
                                         plan_id UUID
                                             REFERENCES subscription_plans(id) ON DELETE SET NULL,

                                         created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                                         updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_info_plan
    ON users_info(plan_id);

CREATE TRIGGER users_info_updated_at
    BEFORE UPDATE ON users_info
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =====================================================
-- USER SECURITY TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS user_security (

                                             user_id UUID PRIMARY KEY
                                                 REFERENCES users(id) ON DELETE CASCADE,

                                             failed_login_attempts INT NOT NULL DEFAULT 0,
                                             failed_otp_attempts INT NOT NULL DEFAULT 0,

                                             account_locked BOOLEAN NOT NULL DEFAULT FALSE,
                                             account_locked_until TIMESTAMPTZ,
                                             otp_locked_until TIMESTAMPTZ,

                                             otp_hash TEXT,
                                             otp_expires_at TIMESTAMPTZ,

                                             mfa_enabled BOOLEAN NOT NULL DEFAULT FALSE,
                                             mfa_secret TEXT,
                                             mfa_temp_secret TEXT,
                                             mfa_temp_expires_at TIMESTAMPTZ,

                                             last_login_at TIMESTAMPTZ,
                                             last_login_ip INET,
                                             last_login_country VARCHAR(120),
                                             last_login_device TEXT,

                                             suspicious_login BOOLEAN NOT NULL DEFAULT FALSE,

                                             updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

                                             CONSTRAINT failed_login_nonnegative_chk
                                                 CHECK (failed_login_attempts >= 0),

                                             CONSTRAINT failed_otp_nonnegative_chk
                                                 CHECK (failed_otp_attempts >= 0)
);

CREATE INDEX IF NOT EXISTS idx_user_security_last_login_ip
    ON user_security(last_login_ip);

ALTER TABLE user_security
    ADD COLUMN IF NOT EXISTS account_locked BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE user_security
    ADD COLUMN IF NOT EXISTS mfa_temp_secret TEXT;

ALTER TABLE user_security
    ADD COLUMN IF NOT EXISTS mfa_temp_expires_at TIMESTAMPTZ;

ALTER TABLE user_security
    ADD COLUMN IF NOT EXISTS otp_locked_until TIMESTAMPTZ;

CREATE TRIGGER user_security_updated_at
    BEFORE UPDATE ON user_security
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =====================================================
-- QUERIES TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS queries (

                                       id UUID PRIMARY KEY DEFAULT app_uuid(),

                                       user_id UUID NOT NULL
                                           REFERENCES users(id) ON DELETE CASCADE,

                                       service_name VARCHAR(100) NOT NULL,

                                       subject VARCHAR(255) NOT NULL,
                                       message TEXT NOT NULL,

                                       category VARCHAR(50) NOT NULL
                                           CHECK (category IN ('Billing','Technical','Security','Service','General')),

                                       priority INT NOT NULL
                                           CHECK (priority IN (1,2,3)),

                                       status VARCHAR(30) NOT NULL DEFAULT 'Open'
                                           CHECK (status IN ('Open','In Progress','Resolved')),

                                       admin_reply TEXT,

                                       replied_by UUID
                                           REFERENCES users(id) ON DELETE SET NULL,

                                       replied_at TIMESTAMPTZ,

                                       created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                                       updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

                                       CONSTRAINT queries_subject_nonempty_chk
                                           CHECK (length(btrim(subject)) > 0),

                                       CONSTRAINT queries_message_len_chk
                                           CHECK (length(message) <= 5000)
);

CREATE INDEX IF NOT EXISTS idx_queries_user_created
    ON queries(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_queries_status_created
    ON queries(status, created_at DESC);

CREATE TRIGGER queries_updated_at
    BEFORE UPDATE ON queries
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================

ALTER TABLE queries ENABLE ROW LEVEL SECURITY;

CREATE POLICY user_query_select
    ON queries
    FOR SELECT
    USING (user_id = current_setting('app.user_id')::uuid);

CREATE POLICY user_query_insert
    ON queries
    FOR INSERT
    WITH CHECK (user_id = current_setting('app.user_id')::uuid);

CREATE POLICY user_query_update
    ON queries
    FOR UPDATE
    USING (user_id = current_setting('app.user_id')::uuid);

CREATE POLICY user_query_delete
    ON queries
    FOR DELETE
    USING (user_id = current_setting('app.user_id')::uuid);

-- =====================================================
-- FEEDBACK TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS feedback (

                                        id UUID PRIMARY KEY DEFAULT app_uuid(),

                                        user_id UUID NOT NULL
                                            REFERENCES users(id) ON DELETE CASCADE,

                                        service_name VARCHAR(100) NOT NULL,
                                        message TEXT NOT NULL,

                                        rating INT NOT NULL
                                            CHECK (rating BETWEEN 1 AND 5),

                                        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                                        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

                                        CONSTRAINT feedback_message_len_chk
                                            CHECK (length(message) <= 5000)
);

CREATE INDEX IF NOT EXISTS idx_feedback_user_created
    ON feedback(user_id, created_at DESC);

CREATE TRIGGER feedback_updated_at
    BEFORE UPDATE ON feedback
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =====================================================
-- CLOUD USAGE
-- =====================================================

CREATE TABLE IF NOT EXISTS cloud_usage (

                                           id UUID PRIMARY KEY DEFAULT app_uuid(),

                                           user_id UUID NOT NULL
                                               REFERENCES users(id) ON DELETE CASCADE,

                                           usage_date DATE NOT NULL,
                                           storage_used_gb NUMERIC(10,2) NOT NULL DEFAULT 0,
                                           current_usage_gb NUMERIC(10,2) NOT NULL DEFAULT 0,
                                           usage_percentage NUMERIC(6,2) NOT NULL DEFAULT 0,
                                           daily_limit_gb NUMERIC(10,2) NOT NULL DEFAULT 0,
                                           api_requests_today INT NOT NULL DEFAULT 0,
                                           data_transfer_today_gb NUMERIC(10,2) NOT NULL DEFAULT 0,

                                           created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                                           updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

                                           CONSTRAINT cloud_usage_unique_user_day
                                               UNIQUE (user_id, usage_date)
);

CREATE INDEX IF NOT EXISTS idx_cloud_usage_user_date
    ON cloud_usage(user_id, usage_date DESC);

CREATE TRIGGER cloud_usage_updated_at
    BEFORE UPDATE ON cloud_usage
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =====================================================
-- AUDIT LOGS
-- =====================================================

CREATE TABLE IF NOT EXISTS audit_logs (

                                          id UUID PRIMARY KEY DEFAULT app_uuid(),

                                          user_id UUID
                                                                      REFERENCES users(id) ON DELETE SET NULL,

                                          event_type VARCHAR(100) NOT NULL DEFAULT 'generic_event',

                                          action VARCHAR(100) NOT NULL,

                                          status VARCHAR(20) NOT NULL
                                              CHECK (status IN ('success','failure')),

                                          severity VARCHAR(20) NOT NULL DEFAULT 'low'
                                              CHECK (severity IN ('low','medium','high','critical')),

                                          ip INET,
                                          user_agent TEXT,

                                          request_id UUID,

                                          metadata JSONB,

                                          event_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_event_time
    ON audit_logs(event_timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_severity
    ON audit_logs(severity);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user
    ON audit_logs(user_id, event_timestamp DESC);

-- =====================================================
-- REFRESH TOKENS
-- =====================================================

CREATE TABLE IF NOT EXISTS refresh_tokens (

                                              id UUID PRIMARY KEY DEFAULT app_uuid(),

                                              user_id UUID NOT NULL
                                                  REFERENCES users(id) ON DELETE CASCADE,

                                              token_hash TEXT NOT NULL,

                                              created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                                              expires_at TIMESTAMPTZ NOT NULL,

                                              revoked BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user
    ON refresh_tokens(user_id);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_hash
    ON refresh_tokens(token_hash);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expiry
    ON refresh_tokens(expires_at);

-- =====================================================
-- BLOCKED IPS
-- =====================================================

CREATE TABLE IF NOT EXISTS blocked_ips (

                                           id UUID PRIMARY KEY DEFAULT app_uuid(),

                                           ip_address INET NOT NULL UNIQUE,

                                           blocked_until TIMESTAMPTZ NOT NULL,

                                           reason TEXT,

                                           created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_blocked_ips_lookup
    ON blocked_ips(ip_address, blocked_until DESC);

CREATE INDEX IF NOT EXISTS idx_blocked_ips_expiry
    ON blocked_ips(blocked_until);

-- =====================================================
-- INTRUSION DETECTION VIEW
-- =====================================================

CREATE VIEW suspicious_login_attempts AS
SELECT
    ip,
    COUNT(*) AS attempts
FROM audit_logs
WHERE event_type = 'login_password_failed'
  AND event_timestamp > NOW() - INTERVAL '5 minutes'
GROUP BY ip
HAVING COUNT(*) > 5;
