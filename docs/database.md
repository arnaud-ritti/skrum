# Database

Skrüm runs on PostgreSQL, MariaDB, MySQL and SQLite from one code base. The first half of this document is for
operators: which engine to choose, what each one needs, and what an upgrade does. The second half is for
contributors: the rules database code follows and how to run the tests on each engine.

## Which database to choose

| Engine | Minimum version | Choose it when | Know that |
|---|---|---|---|
| PostgreSQL | 14 | by default | it is what Skrüm is developed on and what the browser tests run on |
| MariaDB | 10.11 | it is what you already run and back up | Skrüm sets a binary collation and READ COMMITTED on its connection and refuses to start without them |
| MySQL | 8.4 | it is what you already run and back up | the same as MariaDB; it is tested nightly rather than on every change |
| SQLite | 3.35 | you want one container and no database server, for a small instance | one writer at a time (see below) |

Every engine needs PHP 8.4 or later (the image ships it). On SQLite, PHP 8.4 is what lets a transaction take the
write lock when it begins.

Use the connection that names your server: `DB_CONNECTION=mariadb` for MariaDB, `DB_CONNECTION=mysql` for MySQL. A
`mysql` connection pointed at a MariaDB server is compared with MySQL's minimum version and MySQL's collation, and
`skrum:check-database` refuses it.

## SQLite: what "small" means

SQLite lets one write happen at a time. Every write (a card, a vote, a reaction, a whiteboard stroke, a queued job)
waits for the one before it. A few teams, and sessions of a few dozen people, are fine. When a write has waited
five seconds, the action fails with "The database is busy. Try again." (HTTP 503, see below) and nothing is lost.

- Keep the file on a local disk, never on a network share: SQLite's locks do not work there.
- Back it up with `sqlite3 skrum.sqlite ".backup 'copy.sqlite'"`, not by copying the file while Skrüm runs. The
  file is in write-ahead mode: a copy of `skrum.sqlite` alone, without its `-wal` file, can miss the latest writes.
- Keep sessions and the cache out of it (`SESSION_DRIVER=file`, `CACHE_STORE=file`), so that their writes do not
  queue behind the application's. `compose.production.sqlite.yaml` does this. Those files live in the container,
  not in a volume: recreating the container signs everyone out and empties the cache. The queue stays in the
  database.

## Settings Skrüm needs, and why

Skrüm sets these on its own connection (`config/database.php`); you do not set them on the server. They are listed
so that you know what goes wrong if they are changed.

| Engine | Setting | Value | Without it |
|---|---|---|---|
| MariaDB | collation (`DB_COLLATION`) | `utf8mb4_nopad_bin` | with a `_ci` collation every emoji is the same reaction, `Ada` is `ada`, and two names that differ only by a trailing space collide |
| MySQL | collation (`DB_COLLATION`) | `utf8mb4_0900_bin` | the same |
| MariaDB, MySQL | isolation level | READ COMMITTED | a limit (votes, saved decks, templates) or a uniqueness check can be passed by two requests at the same moment |
| MariaDB, MySQL | time zone | `+00:00` | dates are stored in the server's zone and read back shifted |
| SQLite | `journal_mode` | `wal` | readers block the writer |
| SQLite | `busy_timeout` | 5000 ms | a write fails at once instead of waiting its turn |
| SQLite | `transaction_mode` | `IMMEDIATE` | a transaction takes the write lock too late, and two of them fail instead of queueing |
| SQLite | foreign keys (`DB_FOREIGN_KEYS`) | on | deleting a team or a retro leaves its rows behind |

Leave `DB_FOREIGN_KEYS` unset or `true`; `false`, `0` or an empty value turn foreign keys off. PostgreSQL needs
no setting: search and name comparison are folded by the application, so the locale of the database does not matter.

The server's own defaults do not matter either: on a stock MySQL 8.4 (`utf8mb4_0900_ai_ci`, REPEATABLE READ) Skrüm
creates every table with `utf8mb4_0900_bin` and runs its sessions in READ COMMITTED. What matters is that the tables
were created by Skrüm's connection. A table created by hand, or by a version of Skrüm configured with another
collation, keeps the collation it was created with.

### `php artisan skrum:check-database`

The command reads the connection's configuration, the server version and the collation of every table, and says
what is wrong in one sentence per problem:

- the server version is older than the minimum of the table above;
- the connection collation does not end in `_bin`;
- the isolation level is not READ COMMITTED;
- on SQLite, `transaction_mode` is not `IMMEDIATE`, `journal_mode` is not `wal` (for a file), or foreign keys are off;
- tables were created with a collation that is not binary (it names up to five of them);
- the connection is not one of the four supported engines (it has no `minimum_version`; SQL Server is refused this way).

It exits 0 with "The database is ready." when it finds nothing, and 1 otherwise. `--database=<connection>` checks
another connection than the default. The container runs it at every start, after the configuration is cached and
before the migrations: when it fails, the container stops with the sentence in its log
(`docker compose logs app`) and does not migrate.

## When the database is busy

A deadlock, a lock wait that timed out, or a SQLite file whose writer held the lock past the busy timeout is not
the user's fault: the same action would succeed a moment later. Transactions that only touch the database are
retried up to three times. If the conflict survives the retries, Skrüm answers HTTP 503 with `Retry-After: 1` and
the message "The database is busy. Try again.": as JSON for an API or JSON request, as a toast on the page for an
action taken in the application, and as the 503 page for a plain browser request. Nothing was written.

On MariaDB and MySQL a retried transaction blocked by a lock wait can hold its worker for up to three times the
server's `innodb_lock_wait_timeout` (50 s by default) before the 503. Ordinary use does not come near it.

Frequent 503 responses on SQLite mean the instance has outgrown it: move to a server engine (see "Changing engine").

## The database holds keys, not rules

Skrüm writes through its models, which enforce its rules (who may be assigned an action item, what a recurrence
needs, who owns a deck) and maintain the columns that search, order and uniqueness read: `name_key`, `email_key`,
the `*_search` columns, `action_items.sort_rank` and `game_points.week_start`. A row written by hand or by another
tool is not checked, and must set those columns itself: a row without `name_key`, `sort_rank` or `week_start` is
refused by the database, and a changed source column whose derived column is left as it was makes the row wrong in
search, order or uniqueness until the model saves it again.

## Installing

`.env.example` has one block per engine; uncomment the one you want. Three Compose files start the image:

| File | Database |
|---|---|
| `compose.production.yaml` | PostgreSQL 18 in its own container |
| `compose.production.mariadb.yaml` | MariaDB 11.8 in its own container, started with a binary collation and READ COMMITTED |
| `compose.production.sqlite.yaml` | no database container: the file is `/app/database/data/skrum.sqlite`, in the `sqlite-data` volume |

For MySQL, or for a database server you already run, use `compose.production.yaml` without its `pgsql` service and
set `DB_CONNECTION`, `DB_HOST`, `DB_PORT`, `DB_DATABASE`, `DB_USERNAME` and `DB_PASSWORD`. The container requires
`DB_CONNECTION`, and `DB_PASSWORD` for a server engine or `DB_DATABASE` for SQLite. It creates the SQLite file and
its folder when they are missing.

## Upgrading an existing PostgreSQL instance

Back up the database, then start the new image: it runs `php artisan migrate` at start. The migrations of this
release:

- add `name_key` to saved templates, whiteboard templates and saved decks, `email_key` to users, the `*_search`
  columns to cards, action items, retros, poker games and tasks, whiteboards, game rooms and users, `sort_rank` to
  action items and `week_start` to game points;
- fill them, one update per row: every card, action item, retro, saved template and deck, user and points row is
  rewritten once;
- add their indexes, and drop four unique indexes on `lower(name)` that the new keys replace;
- drop the database defaults of five JSON columns of `game_rounds` (the model gives them instead);
- bring the addresses of workspace invitations to the form addresses are compared by (lower case, no surrounding spaces).

The fill is the long part. The migrations that fill the large tables (search columns, `email_key`, `week_start`)
run outside a transaction and look at what is already done, so a run that stopped can be started again. Put the
instance in maintenance mode for the upgrade on a large instance: a row written by the old release while the
search columns fill stays out of search until its next save. As an order of magnitude, measured on PostgreSQL 18 on a
laptop's local disk: the search columns of 100 000 cards took 14 seconds, and the small instance of
`tests/Fixtures/pgsql/before-portability.sql` migrates in under a second. Count about 15 seconds per 100 000 rows of
cards, action items, retros and users together, more on a slower disk or a busy server.

If two saved templates (or whiteboard templates, or decks) of one owner had names that differ only by case or by
surrounding spaces, both are kept with their names; the later one gets a key of its own, and the log says which
row (`Two rows of … share a name once case and spaces are ignored`).

**Five check constraints from earlier versions stay on your database.** A fresh install does not have them, and
they duplicate rules the application enforces in its models. They are harmless. To remove them (optional), run as
the owner of the database:

```sql
alter table action_items drop constraint action_items_single_assignee;
alter table action_items drop constraint action_items_guest_assignee_needs_retro;
alter table action_items drop constraint action_items_recurrence_needs_due_date;
alter table team_health_statements drop constraint team_health_statements_builtin_or_custom;
alter table poker_decks drop constraint poker_decks_single_owner;
```

### Accounts that share an address

Addresses are compared without regard to case or surrounding spaces. Accounts created before that rule may share
an address (`Ada@example.com` and `ada@example.com`). Skrüm refuses to pick one of them for single sign-on or a
magic link, and no new account can take that address.

```bash
php artisan users:report-duplicate-emails
```

lists each shared address with its accounts (id, address as stored, name, verified or not, role, creation date). It
changes nothing: change the address of, or remove, the accounts that should not have it, until each address has one.

## Changing engine

Not supported: there is no tool to move the data of an instance from one engine to another. SQL Server is not
supported either: the schema does not migrate there.

## What differs between engines

The behaviour of Skrüm is the same on the four engines, with these exceptions:

| What | How it differs |
|---|---|
| Alphabetical order | Lists are sorted by the application, the same way everywhere. A paginated list (the estimates page, for example) takes the engine's order to decide which rows make a page, so capitals and accented names can fall on another page from one engine to the next. |
| Accents in search | Search respects accents on every engine: `ete` does not find `été`. Case is ignored everywhere. |
| `%`, `_`, `*`, `?`, `[`, `]`, `\` in a search term | They are found as themselves on every engine. On the paginated estimates page a term with one of them can return a page shorter than the others. |
| Dates after 2038 | Timestamp columns (creation and update times among them) cannot hold a moment after January 2038 on MariaDB and MySQL. Due dates are plain dates and are not affected. |
| Writes at the same moment | Server engines let many people write at once. SQLite lets one write at a time; the others wait up to five seconds. |

## Rules for database code

Owner rule: **use Eloquent simply, without raw queries, and respect Laravel conventions.** Database code must run
unchanged on PostgreSQL, MySQL, MariaDB and SQLite.

`tests/Arch/DatabasePortabilityTest.php` enforces most of this in `app/`, `database/` (migrations, seeders,
factories) and `tests/`. Nothing is excused: there is no baseline and no allowed list, and a test fails if
either comes back.

1. No raw query. No `whereRaw`, `orWhereRaw`, `selectRaw`, `orderByRaw`, `havingRaw`, `groupByRaw`, `fromRaw`, `DB::raw`, `DB::statement`, `DB::unprepared`, no `DB::select`, `DB::insert`, `DB::update` or `DB::delete` with an SQL string, no `Expression` object. Only Eloquent models, relationships, scopes and the standard methods of the query builder (`withCount`, `withSum`, `count()`, `sum()`, `groupBy`, `lockForUpdate`, …). No helper wraps raw SQL.
2. What SQL cannot say the same way on the four engines is done in PHP, on the rows or the collection: conditional counts, computed sort keys, where NULL sorts, date truncation, case folding. PHP works on bounded sets only; where a set grows without bound, use a relationship aggregate (`withCount`, `withSum`) or store a derived column the model maintains. Cast aggregates in PHP (`(int)`, `(float)`): engines return them as different types.
3. No test of the driver: no `getDriverName()`, no comparison of the connection name, no `instanceof` on a connection or grammar class, in code, migrations, seeders, factories or tests.
4. Case-insensitive search goes through the scope `whereContains()` of `App\Concerns\HasSearchColumns` (a folded `*_search` column, a term folded in PHP), followed by `SearchText::contains()` on the rows. `whereLike` is used only with `caseSensitive: true` and only on a folded column; the operator strings `'like'` and `'ilike'` are not used. Case-insensitive equality: fold the value in PHP and compare with a stored key (`name_key`, `email_key`). `insertOrIgnore`, `whereJsonContains` and `whereJsonLength` are not used: their meaning differs per engine. The `*_search` columns are written by the model's `saving` hook, so no write skips the model events (`WithoutModelEvents`, `withoutEvents()`, `saveQuietly()`, …); a row written without the model is filled at its next save. The migration that adds them fills the existing rows outside a transaction and can be run again after a failure; run it with the application in maintenance mode, or the rows written by the old release in the meantime stay out of search until their next save.
5. Migrations: Schema builder only, `up` only. No raw index or constraint SQL, no expression or partial index, no `->collation()`, no database default on a JSON column (use the model's `$attributes`). `dateTime()` rather than `timestamp()` for a non-null column, `longText()` for anything that can exceed 64 KB. An invariant the Schema builder cannot express on every engine is enforced in the model. Historic migrations are edited for fresh installs; what an existing install needs is a new migration.
6. Transactions: lock the aggregate root first (`lockForUpdate()`), before any other query of the transaction. A statement that may fail inside a transaction runs in its own nested `DB::transaction`. No DDL inside a transaction. `DB::transaction($callback, Transactions::Attempts)` only when the callback touches nothing but the database: a retried callback runs again from its first line, so it must not broadcast, send mail or save a model it loaded outside the transaction.
7. Sorting: add an explicit tie-breaker; never depend on where NULL sorts or on alphabetical order from SQL. Lists read by people are sorted in PHP with `Alphabetical::sort()`.
8. Tests: never read SQL text, quoting or `for update` (count the query log, do not read it; `Tests\Support\SqlProbe` is the only reader, and it takes the lock clause and the quoting from the grammar); never use an SQL error such as `select 1 / 0` to simulate a failure (`Tests\Support\DatabaseFailure` and `UnreachableDatabase` do it without SQL); no `Schema::` change inside a test.
9. Stored derived columns are written by the model and by nothing else: `name_key` (the `name` mutator of `WorkspaceTemplate`, `WhiteboardTemplate`, `SavedPokerDeck`), `email_key` (`User`, through `LoginAddress::normalise()`), `action_items.sort_rank` (`ActionItem::save()`, from `completed_at`, `due_on`, `priority`), `game_points.week_start` (the `created_at` mutator of `GamePoint`), the `*_search` columns (rule 4). A write that goes past the model (`DB::table()`, an `update()` on a query or a relation, `upsert`, `insert`) on one of these tables sets the derived column itself, or leaves the source columns alone. An insert without `name_key`, `sort_rank` or `week_start` fails; a mass update of a source column fails nothing and leaves the derived column stale.
10. JSON columns: MySQL stores the keys of a JSON object in its own order. A test never compares a JSON column with `toBe`; it uses `toBeIgnoringKeyOrder` (defined in `tests/Pest.php`), and code never depends on the order of keys read back from one.
11. Dates without a time are cast with `App\Casts\DateOnly`, and a due date is bound as a `Y-m-d` string, never a Carbon instance: SQLite compares dates as text.
12. Before committing a change to database code, run the tests you touched on PostgreSQL and on one other engine: `bin/test-db pgsql -- <path>` and `bin/test-db mariadb -- <path>`.

### What lives where

| Class | Use it when |
|---|---|
| `App\Support\Database\NameKey` | a name must be unique regardless of case and surrounding spaces: `NameKey::of($name)` is the stored `name_key` |
| `App\Support\Database\SearchText` | a column is searched: `fold()` is what `*_search` stores, `pattern()` the term given to SQL, `contains()` the exact check on the rows SQL returned |
| `App\Concerns\HasSearchColumns` | a model has searchable columns: declare `searchColumns()`, search with `whereContains()` / `orWhereContains()` |
| `App\Support\Database\Transactions` | a transaction may be retried (`Transactions::Attempts`), or an exception must be recognised as a deadlock or a busy database |
| `App\Support\Database\DatabaseRequirements` | the configuration must be checked: `problems($connection)` behind `skrum:check-database` |
| `App\Support\Alphabetical` | a list read by people is sorted by name |
| `App\Casts\DateOnly` | a column holds a date without a time |
| `App\Exceptions\ModelInvariantViolation` | a model refuses a row that breaks one of its rules |
| `App\Support\Auth\LoginAddress` | an e-mail address is compared or stored as `email_key` |

## Running the tests on an engine

`phpunit.xml` runs the suite on SQLite in memory: `php artisan test` and `composer test` need no database server.
`bin/test-db` runs it on a chosen engine:

```
bin/test-db <sqlite|sqlite-file|pgsql|mariadb|mysql> [--concurrency] [-- arguments of artisan test]
```

PostgreSQL runs with Sail. MariaDB and MySQL are started once, by name: `docker compose up -d mariadb mysql`.
Without arguments the script runs Unit, Feature, Upgrade and Arch in parallel and prints one line,
`test-db <driver>: PASS|FAIL, Tests: …`; with arguments it runs them in one process. The header of `bin/test-db`
lists the variables that change the host, the port, the database name (it must start with `testing`) and the
container (needed from a git worktree); `TEST_DB_ON_HOST=1` uses the host's PHP, as CI does.

Before any test the script migrates the schema once. If a migration fails it says which and exits 3 without running
a test: every database test would otherwise fail on it and run the migrations again, which takes hours on a server
engine. **Until the migrations pass on an engine, run one test file there, never the suite.**

| Command | What it runs |
|---|---|
| `bin/test-db pgsql -- tests/Feature/Database/NameKeysTest.php` | one file, one process: the form to use while working |
| `bin/test-db mariadb -- --filter="keeps the name unique"` | one test |
| `bin/test-db pgsql` (or `sqlite`, `mariadb`, `mysql`) | Unit, Feature, Upgrade and Arch, in parallel |
| `bin/test-db <pgsql\|mariadb\|mysql\|sqlite-file> --concurrency` | `tests/Concurrency`, in one process |
| `bin/check-pg-upgrade` | the PostgreSQL upgrade proof |

Do not run two whole suites at once in the shared container. MySQL is the slowest (about a quarter of an hour with
four processes).

The `Upgrade` suite (`tests/Upgrade`) runs the real migrations that fill derived columns on legacy rows.
`bin/check-pg-upgrade` loads `tests/Fixtures/pgsql/before-portability.sql`, a PostgreSQL database from before this
work, migrates it, and checks that every row and every name is still there and that the schema equals a fresh
install's, except for the five check constraints listed under "Upgrading". The `Upgrade` suite runs on SQLite in
memory, not in a file: its tests call `migrate:fresh`, which empties a SQLite file by truncating it while the
open connection still holds pages in the write-ahead log, and the file then reads as corrupt.

### The concurrency suite

`tests/Concurrency` proves with real connections what a single connection cannot: limits and uniqueness under two
requests at once, lock order, a retry that writes once, the 503 of a busy SQLite file. It runs on PostgreSQL,
MariaDB, MySQL and SQLite in a file (`sqlite-file`), never in memory, and never in parallel.

A race is written with `Tests\Concurrency\Support\Race`: `Race::run($contenders, $pauseAfter)` takes one closure per
contender, starts each in its own PHP process with its own connection (Laravel's `process` concurrency driver),
releases them at the same instant (`RACE_LEAD_SECONDS` after the call, 4 by default; raise it on a slow machine), and
pauses each one 200 ms once. By default the pause comes after its first query inside a transaction
(`Race::FirstQueryInTransaction`), so that without a lock they have all read the same state before the first one
writes; `Race::FirstQuery`, `Race::NoPause` and `Race::firstQueryMentioning('name_key')` (after the first query
whose SQL holds that fragment, for a check made before the transaction opens) are the other choices. It returns,
per contender, `ok`, `value`, `error` (the exception class), `message`, `startedAt` and `endedAt`: an exception in a
contender is reported, not thrown. The closures are `static` and capture scalars only (ids, not models), because
they are serialised into another process. Inside one, `Race::request($userId, $method, $uri, $payload)` sends a
JSON request through the HTTP kernel as that user and returns the status; `Race::response()` returns the status and
the headers. Each test states the protection it proves; removing that protection makes it fail.

### Continuous integration

`.github/workflows/tests.yml` runs:

| Job | When | What |
|---|---|---|
| `ci` | every push and pull request | lint, types, front-end checks and the whole suite on SQLite in memory; `skrum:check-database` and `migrate:fresh --seed` |
| `database (pgsql 18)`, `database (mariadb 10.11)` | every push and pull request | `skrum:check-database`, `migrate:fresh --seed`, the suite, the concurrency suite; `bin/check-pg-upgrade` on PostgreSQL |
| `sqlite-file` | every push and pull request | the same checks on a SQLite file, `tests/Feature/Database` and the concurrency suite |
| `browser` | every push and pull request | the browser suite, on PostgreSQL only |
| `database (mysql 8.4)`, `database (pgsql 14)`, `database (mariadb 11.8)` | nightly | the same as the other `database` jobs |
