#!/bin/bash
# Local dev environment setup
set -e

echo "Setting up local development environment..."
pnpm install

echo "Starting Docker services..."
docker-compose -f docker-compose.dev.yml up -d

echo "Dev setup complete. Please run migrations manually after starting the database."
