INSERT INTO subscription_plans (
    plan_name,
    storage_limit_gb,
    daily_limit_gb,
    api_limit_per_day,
    data_transfer_limit_gb
)
VALUES ('Starter', 100.00, 10.00, 1000, 50.00)
ON CONFLICT (plan_name) DO UPDATE
SET storage_limit_gb = EXCLUDED.storage_limit_gb,
    daily_limit_gb = EXCLUDED.daily_limit_gb,
    api_limit_per_day = EXCLUDED.api_limit_per_day,
    data_transfer_limit_gb = EXCLUDED.data_transfer_limit_gb;

INSERT INTO users (
    email,
    password_hash,
    role,
    is_active,
    email_verified
)
VALUES (
    'pothujayanthreddy6859@gmail.com',
    '$2b$12$hmncHpxmiryk2jDO/7tCt.N3Y.1ijbPKn1wp4vzqSPZbGqblxw9Cu',
    'user',
    TRUE,
    TRUE
)
ON CONFLICT (email) DO UPDATE
SET password_hash = EXCLUDED.password_hash,
    role = EXCLUDED.role,
    is_active = TRUE,
    email_verified = TRUE;

INSERT INTO users_info (
    user_id,
    name,
    plan_id
)
SELECT
    u.id,
    'Jayanth',
    sp.id
FROM users u
JOIN subscription_plans sp ON sp.plan_name = 'Starter'
WHERE u.email = 'pothujayanthreddy6859@gmail.com'
ON CONFLICT (user_id) DO UPDATE
SET name = EXCLUDED.name,
    plan_id = EXCLUDED.plan_id;

INSERT INTO user_security (
    user_id,
    failed_login_attempts,
    failed_otp_attempts,
    account_locked,
    otp_locked_until,
    mfa_enabled,
    mfa_secret
)
SELECT
    u.id,
    0,
    0,
    FALSE,
    NULL,
    FALSE,
    NULL
FROM users u
WHERE u.email = 'pothujayanthreddy6859@gmail.com'
ON CONFLICT (user_id) DO UPDATE
SET failed_login_attempts = 0,
    failed_otp_attempts = 0,
    account_locked = FALSE,
    otp_locked_until = NULL,
    mfa_enabled = FALSE,
    mfa_secret = NULL;

INSERT INTO queries (
    user_id,
    service_name,
    subject,
    message,
    category,
    priority,
    status,
    created_at,
    updated_at
)
SELECT
    u.id,
    'Storage Gateway',
    'Usage spike investigation - pothujayanthreddy6859',
    'Observed a sudden increase in storage consumption over the last 24 hours. User account: pothujayanthreddy6859@gmail.com.',
    'Technical',
    2,
    'Open',
    NOW() - INTERVAL '1 day',
    NOW()
FROM users u
WHERE u.email = 'pothujayanthreddy6859@gmail.com'
  AND NOT EXISTS (
    SELECT 1
    FROM queries q
    WHERE q.user_id = u.id
      AND q.subject = 'Usage spike investigation - pothujayanthreddy6859'
  );

INSERT INTO queries (
    user_id,
    service_name,
    subject,
    message,
    category,
    priority,
    status,
    created_at,
    updated_at
)
SELECT
    u.id,
    'Identity Manager',
    'MFA enforcement confirmation - pothujayanthreddy6859',
    'Need confirmation that MFA enrollment is being enforced correctly for this account. User account: pothujayanthreddy6859@gmail.com.',
    'Security',
    3,
    'In Progress',
    NOW() - INTERVAL '3 days',
    NOW() - INTERVAL '2 days'
FROM users u
WHERE u.email = 'pothujayanthreddy6859@gmail.com'
  AND NOT EXISTS (
    SELECT 1
    FROM queries q
    WHERE q.user_id = u.id
      AND q.subject = 'MFA enforcement confirmation - pothujayanthreddy6859'
  );

INSERT INTO queries (
    user_id,
    service_name,
    subject,
    message,
    category,
    priority,
    status,
    admin_reply,
    replied_at,
    created_at,
    updated_at
)
SELECT
    u.id,
    'Billing Console',
    'Plan usage clarification - pothujayanthreddy6859',
    'Need clarification on the current storage plan usage and included daily transfer limits. User account: pothujayanthreddy6859@gmail.com.',
    'Billing',
    1,
    'Resolved',
    'The request was reviewed and resolved by support.',
    NOW() - INTERVAL '5 days',
    NOW() - INTERVAL '6 days',
    NOW() - INTERVAL '5 days'
FROM users u
WHERE u.email = 'pothujayanthreddy6859@gmail.com'
  AND NOT EXISTS (
    SELECT 1
    FROM queries q
    WHERE q.user_id = u.id
      AND q.subject = 'Plan usage clarification - pothujayanthreddy6859'
  );

INSERT INTO feedback (
    user_id,
    service_name,
    message,
    rating,
    created_at,
    updated_at
)
SELECT
    u.id,
    'Dashboard',
    'The dashboard is clear and the usage cards are easy to understand. Submitted by Jayanth.',
    5,
    NOW() - INTERVAL '2 days',
    NOW() - INTERVAL '2 days'
FROM users u
WHERE u.email = 'pothujayanthreddy6859@gmail.com'
  AND NOT EXISTS (
    SELECT 1
    FROM feedback f
    WHERE f.user_id = u.id
      AND f.message = 'The dashboard is clear and the usage cards are easy to understand. Submitted by Jayanth.'
  );

INSERT INTO feedback (
    user_id,
    service_name,
    message,
    rating,
    created_at,
    updated_at
)
SELECT
    u.id,
    'Support Portal',
    'The query tracking view is helpful, but I would like faster updates on resolution status. Submitted by Jayanth.',
    4,
    NOW() - INTERVAL '8 days',
    NOW() - INTERVAL '8 days'
FROM users u
WHERE u.email = 'pothujayanthreddy6859@gmail.com'
  AND NOT EXISTS (
    SELECT 1
    FROM feedback f
    WHERE f.user_id = u.id
      AND f.message = 'The query tracking view is helpful, but I would like faster updates on resolution status. Submitted by Jayanth.'
  );

INSERT INTO cloud_usage (
    user_id,
    usage_date,
    storage_used_gb,
    current_usage_gb,
    usage_percentage,
    daily_limit_gb,
    api_requests_today,
    data_transfer_today_gb
)
SELECT
    u.id,
    CURRENT_DATE,
    25.00,
    25.00,
    25.00,
    10.00,
    342,
    6.80
FROM users u
WHERE u.email = 'pothujayanthreddy6859@gmail.com'
ON CONFLICT (user_id, usage_date) DO UPDATE
SET storage_used_gb = EXCLUDED.storage_used_gb,
    current_usage_gb = EXCLUDED.current_usage_gb,
    usage_percentage = EXCLUDED.usage_percentage,
    daily_limit_gb = EXCLUDED.daily_limit_gb,
    api_requests_today = EXCLUDED.api_requests_today,
    data_transfer_today_gb = EXCLUDED.data_transfer_today_gb,
    updated_at = NOW();
