# Contributing to Skrum

Thanks for wanting to help. This page covers what you need to send a change that can be merged.

By taking part you agree to the [code of conduct](CODE_OF_CONDUCT.md).

## Before you start

- **Bugs**: open an issue with the bug form, or send the fix directly if it is small.
- **Features and behaviour changes**: open an issue first. Skrum is spec-driven: a change is described with explicit acceptance criteria and agreed on before any code is written. A pull request that arrives without that conversation may be declined even if the code is good.
- **Security problems**: never in a public issue. See the [security policy](SECURITY.md).

## Setup

Development uses Laravel Sail, so you need Docker and Node.js 22.

```bash
composer install
cp .env.example .env
vendor/bin/sail up -d
vendor/bin/sail artisan key:generate
vendor/bin/sail artisan migrate
npm install
vendor/bin/sail composer run dev
npm run dev
```

Optional demo data (local environment only):

```bash
vendor/bin/sail artisan db:seed --class=DemoSeeder
```

Demo accounts: `facilitator@skrum.test` and `member@skrum.test`, password `password`.

## Checks before a pull request

```bash
vendor/bin/sail composer ci:check
```

This runs the front-end checks (`npm run check`, `npm run types:check`), Pint, PHPStan and the Pest suite. The same checks run in CI.

- `vendor/bin/sail composer lint` fixes PHP formatting.
- `npm run check:fix` fixes front-end formatting and lint errors.
- `vendor/bin/sail composer test:browser` runs the browser suite. Run it when your change touches the interface.

Add or update tests for any change in behaviour. Copy, styling and layout-only changes do not need new tests.

## Database

Skrum runs on PostgreSQL, SQLite, MariaDB and MySQL. Every query and migration must work on all four: no engine-specific SQL, no raw expressions that only one of them understands. The rules are in [`docs/database.md`](docs/database.md), and CI runs the suite against each engine.

Migrations only have an `up` method.

## Translations

Skrum ships in English, French, Spanish and German. Every user-facing string goes through the translation files in `lang/` and must be added in all four languages in the same pull request.

The interface addresses people informally: _tu_ in French, _tú_ in Spanish, _du_ in German. That includes e-mails.

## Commits

Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/): `type(scope): sentence`, where the sentence says what is now true.

```
fix(whiteboard): a locked element can be clicked and unlocked
feat(reactions): the emoji picker in the poker room and on the whiteboard
```

Types in use: `feat`, `fix`, `style`, `refactor`, `test`, `docs`, `chore`.

## Licence

Skrum is released under the [GNU Affero General Public License v3.0 or later](LICENSE). By submitting a contribution you agree that it is released under the same licence. There is no contributor licence agreement to sign.
