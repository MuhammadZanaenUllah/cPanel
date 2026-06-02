#!/bin/bash
# Bootstrap Ubuntu 22.04 with all daemons
# Must be idempotent

set -e

if [ "$EUID" -ne 0 ]; then
  echo "Please run as root"
  exit 1
fi

echo "Updating system..."
apt-get update
apt-get install -y software-properties-common curl wget gnupg2 ca-certificates lsb-release apt-transport-https

echo "Adding PHP repository..."
add-apt-repository -y ppa:ondrej/php
apt-get update

echo "Installing Nginx, Postfix, Dovecot, PowerDNS, ProFTPd, Certbot, Redis, MariaDB/MySQL client tools, PHP..."
apt-get install -y \
  nginx \
  postfix \
  postfix-mysql \
  dovecot-core \
  dovecot-imapd \
  dovecot-pop3d \
  dovecot-mysql \
  pdns-server \
  pdns-backend-mysql \
  proftpd-core \
  proftpd-mod-mysql \
  certbot \
  python3-certbot-nginx \
  redis-server \
  mysql-server \
  php8.1-fpm php8.1-cli php8.1-mysql php8.1-common \
  php8.2-fpm php8.2-cli php8.2-mysql php8.2-common \
  php8.3-fpm php8.3-cli php8.3-mysql php8.3-common \
  quota \
  quotatool \
  tar \
  gzip \
  rsync

echo "Base packages installed successfully."
