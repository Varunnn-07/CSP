-- Development-only maintenance and dashboard seed data.

INSERT INTO users (id, email, password_hash, role, email_verified)
VALUES (
           app_uuid(),
           'user1@csp.com',
           '$2b$10$g0xZrjWq7s4h2sY4u1G0EOm0r7WbJxV7yL3YpQ9t6Q7q1QZ9J5H9K',
           'user',
           TRUE
       )
ON CONFLICT (email) DO NOTHING;

INSERT INTO user_security (user_id)
SELECT u.id
FROM users u
LEFT JOIN user_security s ON s.user_id = u.id
WHERE s.user_id IS NULL;

INSERT INTO subscription_plans (
    plan_name,
    storage_limit_gb,
    daily_limit_gb,
    api_limit_per_day,
    data_transfer_limit_gb
)
VALUES
    ('Starter', 100.00, 10.00, 1000, 50.00),
    ('Growth', 250.00, 25.00, 3500, 180.00),
    ('Enterprise', 750.00, 60.00, 10000, 600.00)
ON CONFLICT (plan_name) DO UPDATE
SET storage_limit_gb = EXCLUDED.storage_limit_gb,
    daily_limit_gb = EXCLUDED.daily_limit_gb,
    api_limit_per_day = EXCLUDED.api_limit_per_day,
    data_transfer_limit_gb = EXCLUDED.data_transfer_limit_gb;

WITH ordered_users AS (
    SELECT
        u.id,
        u.email,
        u.role,
        ROW_NUMBER() OVER (ORDER BY u.email) AS rn
    FROM users u
),
plan_assignment AS (
    SELECT
        ou.id AS user_id,
        CASE
            WHEN ou.role = 'admin' THEN 'Enterprise'
            WHEN MOD(ou.rn, 3) = 1 THEN 'Starter'
            WHEN MOD(ou.rn, 3) = 2 THEN 'Growth'
            ELSE 'Enterprise'
        END AS plan_name,
        ou.email,
        ou.rn
    FROM ordered_users ou
)
INSERT INTO users_info (
    user_id,
    name,
    phone,
    company_name,
    country,
    plan_id
)
SELECT
    pa.user_id,
    INITCAP(REPLACE(SPLIT_PART(pa.email, '@', 1), '.', ' ')),
    '+1-202-555-' || LPAD((1000 + pa.rn)::text, 4, '0'),
    CASE
        WHEN pa.plan_name = 'Enterprise' THEN 'CSP Enterprise Ops'
        WHEN pa.plan_name = 'Growth' THEN 'Secure Growth Labs'
        ELSE 'Cloud Starter Works'
    END,
    CASE MOD(pa.rn, 5)
        WHEN 0 THEN 'United States'
        WHEN 1 THEN 'Canada'
        WHEN 2 THEN 'United Kingdom'
        WHEN 3 THEN 'Germany'
        ELSE 'India'
    END,
    sp.id
FROM plan_assignment pa
JOIN subscription_plans sp ON sp.plan_name = pa.plan_name
ON CONFLICT (user_id) DO UPDATE
SET name = EXCLUDED.name,
    phone = EXCLUDED.phone,
    company_name = EXCLUDED.company_name,
    country = EXCLUDED.country,
    plan_id = EXCLUDED.plan_id;

WITH admin_user AS (
    SELECT id
    FROM users
    WHERE role = 'admin'
    ORDER BY email
    LIMIT 1
),
query_templates AS (
    SELECT *
    FROM (
        VALUES
            ('API Gateway', 'API latency review', 'Observed higher response times for customer requests during business hours.', 'Technical', 2, 'Open', 2),
            ('Billing Console', 'Invoice clarification', 'Need clarification for compute and storage charges on the latest invoice.', 'Billing', 1, 'Resolved', 6),
            ('Identity Manager', 'Access policy verification', 'Need confirmation that the latest IAM policy changes were applied correctly.', 'Security', 3, 'In Progress', 1)
    ) AS t(service_name, subject_prefix, message_body, category, priority, status, days_ago)
)
INSERT INTO queries (
    user_id,
    service_name,
    subject,
    message,
    category,
    priority,
    status,
    admin_reply,
    replied_by,
    replied_at,
    created_at,
    updated_at
)
SELECT
    u.id,
    qt.service_name,
    qt.subject_prefix || ' - ' || SPLIT_PART(u.email, '@', 1),
    qt.message_body || ' User account: ' || u.email || '.',
    qt.category,
    qt.priority,
    qt.status,
    CASE
        WHEN qt.status = 'Open' THEN NULL
        WHEN qt.status = 'Resolved' THEN 'Issue reviewed and resolved by the support team.'
        ELSE 'Support team is actively reviewing this request.'
    END,
    CASE
        WHEN qt.status = 'Open' THEN NULL
        ELSE (SELECT id FROM admin_user)
    END,
    CASE
        WHEN qt.status = 'Open' THEN NULL
        ELSE NOW() - make_interval(days => GREATEST(qt.days_ago - 1, 0))
    END,
    NOW() - make_interval(days => qt.days_ago),
    NOW() - make_interval(days => GREATEST(qt.days_ago - 1, 0))
FROM users u
CROSS JOIN query_templates qt
WHERE NOT EXISTS (
    SELECT 1
    FROM queries q
    WHERE q.user_id = u.id
      AND q.subject = qt.subject_prefix || ' - ' || SPLIT_PART(u.email, '@', 1)
);

WITH feedback_templates AS (
    SELECT *
    FROM (
        VALUES
            ('Portal Experience', 'The support portal is easy to navigate and quick to use.', 5, 3),
            ('Usage Dashboard', 'Usage insights are helpful, but I would like more export options.', 4, 8)
    ) AS t(service_name, message_body, rating, days_ago)
)
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
    ft.service_name,
    ft.message_body || ' Submitted by ' || SPLIT_PART(u.email, '@', 1) || '.',
    ft.rating,
    NOW() - make_interval(days => ft.days_ago),
    NOW() - make_interval(days => ft.days_ago)
FROM users u
CROSS JOIN feedback_templates ft
WHERE NOT EXISTS (
    SELECT 1
    FROM feedback f
    WHERE f.user_id = u.id
      AND f.message = ft.message_body || ' Submitted by ' || SPLIT_PART(u.email, '@', 1) || '.'
);

WITH user_plan_limits AS (
    SELECT
        u.id AS user_id,
        ROW_NUMBER() OVER (ORDER BY u.email) AS rn,
        COALESCE(sp.storage_limit_gb, 100.00) AS storage_limit_gb,
        COALESCE(sp.daily_limit_gb, 10.00) AS daily_limit_gb,
        COALESCE(sp.api_limit_per_day, 1000) AS api_limit_per_day,
        COALESCE(sp.data_transfer_limit_gb, 50.00) AS data_transfer_limit_gb
    FROM users u
    JOIN users_info ui ON ui.user_id = u.id
    LEFT JOIN subscription_plans sp ON sp.id = ui.plan_id
),
usage_seed AS (
    SELECT
        upl.user_id,
        (CURRENT_DATE - gs.day_offset) AS usage_date,
        ROUND(
            (upl.storage_limit_gb * (0.18 + (MOD(upl.rn, 5) * 0.06) + ((10 - gs.day_offset) * 0.015)))::numeric,
            2
        ) AS storage_used_gb,
        upl.storage_limit_gb,
        upl.daily_limit_gb,
        upl.api_limit_per_day,
        upl.data_transfer_limit_gb,
        upl.rn,
        gs.day_offset
    FROM user_plan_limits upl
    CROSS JOIN generate_series(0, 9) AS gs(day_offset)
)
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
    us.user_id,
    us.usage_date,
    us.storage_used_gb,
    us.storage_used_gb,
    ROUND(((us.storage_used_gb / NULLIF(us.storage_limit_gb, 0)) * 100)::numeric, 2),
    us.daily_limit_gb,
    LEAST(us.api_limit_per_day, 120 + (us.rn * 29) + ((10 - us.day_offset) * 33)),
    ROUND(
        LEAST(
            us.data_transfer_limit_gb,
            (3.50 + (us.rn * 0.55) + ((10 - us.day_offset) * 0.80))::numeric
        ),
        2
    )
FROM usage_seed us
ON CONFLICT (user_id, usage_date) DO UPDATE
SET storage_used_gb = EXCLUDED.storage_used_gb,
    current_usage_gb = EXCLUDED.current_usage_gb,
    usage_percentage = EXCLUDED.usage_percentage,
    daily_limit_gb = EXCLUDED.daily_limit_gb,
    api_requests_today = EXCLUDED.api_requests_today,
    data_transfer_today_gb = EXCLUDED.data_transfer_today_gb,
    updated_at = NOW();

DELETE FROM refresh_tokens WHERE expires_at < NOW();
