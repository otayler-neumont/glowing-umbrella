-- Minimal seed data (adjust as needed)
INSERT INTO users (id, email, username, cognito_user_id)
VALUES (
    gen_random_uuid(),
    'gm@example.com',
    'demo_gm',
    'cognito-demo-gm'
) ON CONFLICT DO NOTHING;

WITH gm AS (
  SELECT id FROM users WHERE email = 'gm@example.com' LIMIT 1
)
INSERT INTO campaigns (id, name, description, gm_id)
SELECT gen_random_uuid(), 'Demo Campaign', 'A seeded demo campaign', gm.id FROM gm
ON CONFLICT DO NOTHING;
