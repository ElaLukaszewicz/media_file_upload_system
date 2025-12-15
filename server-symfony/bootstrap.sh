#!/usr/bin/env bash
set -euo pipefail

if ! command -v composer >/dev/null 2>&1; then
  echo "Composer is required. Install Composer first: https://getcomposer.org/download/"
  exit 1
fi

composer create-project symfony/skeleton . || true
composer require symfony/mime symfony/rate-limiter symfony/http-client symfony/validator symfony/uid
composer require symfony/monolog-bundle
composer require --dev symfony/test-pack phpunit/phpunit

echo "Symfony backend scaffolded. Configure uploads in src/ and routes in config/routes.yaml."
