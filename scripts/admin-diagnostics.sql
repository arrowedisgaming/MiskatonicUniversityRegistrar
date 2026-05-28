-- Admin activity diagnostics for production D1 (miskatonic-db).
-- Run: npx wrangler d1 execute miskatonic-db --remote --file=scripts/admin-diagnostics.sql

-- Users without any linked OAuth account (provider will show blank in admin)
SELECT u.id, u.email
FROM users u
LEFT JOIN accounts a ON a.user_id = u.id
WHERE a.id IS NULL
LIMIT 50;

-- Orphan investigators (user_id not in users)
SELECT i.id, i.user_id, i.name
FROM investigators i
LEFT JOIN users u ON u.id = i.user_id
WHERE u.id IS NULL;

-- Login event coverage
SELECT COUNT(*) AS login_events FROM analytics_events WHERE event_type = 'login';

-- All analytics event counts by type
SELECT event_type, COUNT(*) AS cnt FROM analytics_events GROUP BY event_type;

-- Per-user sanity check (first 20 users)
SELECT u.email,
  (SELECT COUNT(*) FROM accounts WHERE user_id = u.id) AS accounts,
  (SELECT COUNT(*) FROM investigators WHERE user_id = u.id AND is_archived = 0) AS active_inv,
  (SELECT COUNT(*) FROM investigators WHERE user_id = u.id) AS total_inv,
  datetime(
    (SELECT MAX(created_at) FROM analytics_events WHERE user_id = u.id),
    'unixepoch'
  ) AS last_analytics_at,
  datetime(
    (SELECT MAX(updated_at) FROM investigators WHERE user_id = u.id),
    'unixepoch'
  ) AS last_inv_update_at
FROM users u
LIMIT 20;

-- Users with investigators but zero active (archived-only)
SELECT u.id, u.email,
  (SELECT COUNT(*) FROM investigators WHERE user_id = u.id) AS total_inv,
  (SELECT COUNT(*) FROM investigators WHERE user_id = u.id AND is_archived = 0) AS active_inv
FROM users u
WHERE (SELECT COUNT(*) FROM investigators WHERE user_id = u.id) > 0
  AND (SELECT COUNT(*) FROM investigators WHERE user_id = u.id AND is_archived = 0) = 0;
