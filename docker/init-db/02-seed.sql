-- ============================================
-- Seed Data for Sales Performance Tracker
-- ============================================

-- Create default admin user (password: admin123)
INSERT INTO profiles (id, email, password_hash, username, full_name, is_active)
VALUES (
    'a0000000-0000-0000-0000-000000000001',
    'admin@example.com',
    '$2b$10$rQZ8q9X8m5J5y5J5y5J5yu5J5y5J5y5J5y5J5y5J5y5J5y5J5y5J',
    'admin',
    'System Administrator',
    true
);

-- Assign admin role
INSERT INTO user_roles (user_id, role)
VALUES ('a0000000-0000-0000-0000-000000000001', 'admin');

-- Create a sample team
INSERT INTO teams (id, name, team_type)
VALUES (
    'b0000000-0000-0000-0000-000000000001',
    'Sales Team Alpha',
    'office'
);

RAISE NOTICE 'Seed data inserted successfully!';
RAISE NOTICE 'Default admin: admin@example.com (password needs to be set via signup or manual hash update)';
