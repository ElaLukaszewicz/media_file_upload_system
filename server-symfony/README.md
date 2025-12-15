# Symfony backend scaffold

Composer is not available in this environment, so the backend is staged as a folder with install instructions. Once Composer is installed, run:

1. `cd server-symfony`
2. `composer create-project symfony/skeleton .`
3. Install required bundles:
   - `composer require symfony/mime symfony/rate-limiter symfony/http-client symfony/validator symfony/uid`
   - `composer require symfony/monolog-bundle`
   - `composer require --dev symfony/test-pack phpunit/phpunit`
4. Add upload-specific services/controllers under `src/` and routes in `config/routes.yaml`.

Recommended scripts (add to `composer.json` once scaffolded):
- `"lint": "php bin/console lint:yaml config && php -l public/index.php"` (extend with PHP-CS-Fixer later)
- `"test": "php bin/phpunit"`
- `"serve": "symfony server:start -d"` (or `php -S localhost:8000 -t public`)
