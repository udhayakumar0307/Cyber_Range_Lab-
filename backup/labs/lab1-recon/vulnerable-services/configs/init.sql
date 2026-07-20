-- TechCorp Industries Database
-- Redesigned for guided discovery and module chaining

CREATE DATABASE IF NOT EXISTS techcorp_db;
USE techcorp_db;

-- ============================================================
-- EMPLOYEES TABLE (Module 2: Database Access)
-- Contains discoverable credentials and hints for next modules
-- ============================================================
CREATE TABLE employees (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL,
    password VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'employee',
    secret_note TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO employees (username, password, role, secret_note) VALUES
('admin',    'admin123',      'administrator', 'FLAG_PLACEHOLDER_MOD2'),
('jsmith',   'password1',     'employee',      NULL),
('bjones',   'techcorp2024',  'employee',      NULL),
('sysadmin', '$up3rS3cr3t!',  'sysadmin',      'Backup account active: use backup user for system access');

-- ============================================================
-- CONFIG TABLE (Module 2: Hidden credentials and hints)
-- These hints guide students to Module 3-5
-- ============================================================
CREATE TABLE config (
    id INT AUTO_INCREMENT PRIMARY KEY,
    key_name VARCHAR(100) NOT NULL UNIQUE,
    value TEXT,
    description VARCHAR(255)
);

INSERT INTO config (key_name, value, description) VALUES
('db_version',           '10.6.23-MariaDB',       'Database version (MariaDB)'),
('internal_api_url',     'http://10.10.0.10:9000', 'Internal API endpoint (Module 3 hint)'),
('internal_api_key',     'FLAG_PLACEHOLDER_MOD3',  'API key stored here (Module 3)'),
('backup_user',          'backup',                 'Backup account username (can SSH with this)'),
('backup_password',      'backup123',              'Backup user password (for SSH access)'),
('backup_hint',          'Check /home/backup/.ssh/config for admin console details', 'Hint for Module 4-5'),
('admin_console_port',   '8888',                   'Admin console runs on this port (Module 5 hint)'),
('admin_console_hint',   'Check /home/backup/.ssh/id_rsa.notes for password hint', 'Where to find admin password'),
('tls_ssl_note',         'MySQL requires TLS disabled for client tools (use --skip-ssl)', 'Database connection note');

-- ============================================================
-- SERVICES TABLE (Module 3 hint: reveals API existence)
-- ============================================================
CREATE TABLE services (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100),
    port INT,
    status VARCHAR(20),
    exposed_by_api BOOLEAN DEFAULT TRUE
);

INSERT INTO services (name, port, status, exposed_by_api) VALUES
('FTP',       21,   'ACTIVE', TRUE),
('SSH',       22,   'ACTIVE', TRUE),
('HTTP',      80,   'ACTIVE', TRUE),
('MySQL',     3306, 'ACTIVE', TRUE),
('Internal API', 9000, 'ACTIVE', TRUE),
('Admin Console', 8888, 'ACTIVE (HIDDEN)', FALSE);

-- ============================================================
-- DATABASE USERS (Module 2: Access credentials)
-- ============================================================
CREATE USER IF NOT EXISTS 'scanner'@'%' IDENTIFIED BY '';
GRANT SELECT ON techcorp_db.* TO 'scanner'@'%';

CREATE USER IF NOT EXISTS 'techcorp'@'%' IDENTIFIED BY 'techcorp2024';
GRANT SELECT ON techcorp_db.* TO 'techcorp'@'%';

FLUSH PRIVILEGES;