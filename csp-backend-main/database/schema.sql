CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- USERS TABLE
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,

    role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'admin')),

    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- USER SECURITY TABLE (used by auth.service.js)
CREATE TABLE IF NOT EXISTS user_security (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,

    failed_login_attempts INT NOT NULL DEFAULT 0,
    failed_otp_attempts INT NOT NULL DEFAULT 0,
    account_locked_until TIMESTAMPTZ,

    otp_hash TEXT,
    otp_expires_at TIMESTAMPTZ,

    last_login_at TIMESTAMPTZ,
    last_login_ip INET,

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- QUERIES TABLE (used by query.controller.js)
CREATE TABLE IF NOT EXISTS queries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    service_name VARCHAR(100) NOT NULL,
    subject VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    category VARCHAR(50) NOT NULL CHECK (category IN ('Billing', 'Technical', 'Security', 'Service', 'General')),
    priority INT NOT NULL CHECK (priority IN (1, 2, 3)),
    status VARCHAR(30) NOT NULL DEFAULT 'Open' CHECK (status IN ('Open', 'In Progress', 'Resolved')),

    admin_reply TEXT,
    replied_by UUID REFERENCES users(id) ON DELETE SET NULL,
    replied_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- FEEDBACK TABLE (used by feedback.controller.js)
CREATE TABLE IF NOT EXISTS feedback (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    service_name VARCHAR(100) NOT NULL,
    message TEXT NOT NULL,
    rating INT NOT NULL CHECK (rating BETWEEN 1 AND 5),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- AUDIT LOG TABLE
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    user_id UUID REFERENCES users(id) ON DELETE SET NULL,

    action VARCHAR(100) NOT NULL,
    status VARCHAR(20) NOT NULL CHECK (status IN ('success', 'failure')),

    ip_address INET,
    user_agent TEXT,

    metadata JSONB,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
