CREATE DATABASE IF NOT EXISTS cpanel_clone;
CREATE DATABASE IF NOT EXISTS powerdns;

-- Create users first to guarantee access even if table structures hit issues
CREATE USER IF NOT EXISTS 'cpanel_app'@'%' IDENTIFIED BY 'cpanel_password';
GRANT ALL PRIVILEGES ON cpanel_clone.* TO 'cpanel_app'@'%';

CREATE USER IF NOT EXISTS 'cpanel_admin'@'%' IDENTIFIED BY 'admin_password';
GRANT ALL PRIVILEGES ON *.* TO 'cpanel_admin'@'%' WITH GRANT OPTION;

CREATE USER IF NOT EXISTS 'pdns'@'%' IDENTIFIED BY 'pdns_password';
GRANT ALL PRIVILEGES ON powerdns.* TO 'pdns'@'%';

FLUSH PRIVILEGES;

-- Now build schemas
USE powerdns;

CREATE TABLE IF NOT EXISTS domains (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  master VARCHAR(128) DEFAULT NULL,
  last_check INT DEFAULT NULL,
  type VARCHAR(6) NOT NULL,
  notified_serial INT DEFAULT NULL,
  account VARCHAR(40) DEFAULT NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS records (
  id INT AUTO_INCREMENT PRIMARY KEY,
  domain_id INT DEFAULT NULL,
  name VARCHAR(255) DEFAULT NULL,
  type VARCHAR(10) DEFAULT NULL,
  content TEXT DEFAULT NULL,
  ttl INT DEFAULT NULL,
  prio INT DEFAULT NULL,
  disabled TINYINT(1) DEFAULT 0,
  ordername VARCHAR(255) BINARY DEFAULT NULL,
  auth TINYINT(1) DEFAULT 1,
  FOREIGN KEY(domain_id) REFERENCES domains(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE INDEX rec_name_index ON records(name);
CREATE INDEX nametype_index ON records(name,type);
