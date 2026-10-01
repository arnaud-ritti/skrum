# Webhook Payload History and Redelivery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let Owners/Admins view what skrum sent to their generic outgoing webhook (request headers, body, start of the answer) for 30 days and redeliver any of those deliveries, GitHub-style.

**Architecture:** A new encrypted `integration_delivery_payloads` table holds, per generic-webhook delivery, the message parts (`id`, `event`, `occurredAt`, `data`) written when the delivery is queued, and the last attempt's headers, body and a 2 KB response excerpt written by `WebhookClient` after each attempt. A redelivery is a new delivery row linked by `redelivery_of_id` whose payload copies the original message; the `RedeliverWebhook` job (delivery id only) rebuilds the body with a fresh `sentAt`, signs it with the current secret and adds `X-Skrum-Redelivery: true`. Two JSON endpoints (view, redeliver) feed a View dialog and a Redeliver confirmation in the existing deliveries panel.

**Tech Stack:** Laravel 13 / PHP 8.4, Pest, PostgreSQL (Sail), Inertia v3 + React 19, Wayfinder, Tailwind 4.

**Spec:** `docs/superpowers/specs/2026-10-01-webhook-redelivery-design.md` (parent: `docs/superpowers/specs/2026-09-30-integrations-extended-design.md`, spec 8 §4.5–§4.7).

## Global Constraints

- Scope: deliveries to a generic outgoing webhook (`IntegrationProvider::Webhook`) only — manual shares (`retro_link`, `poker_link`, `retro_results`, `game_room_link`), automatic events (`event`) and redeliveries. Test messages (`WebhookMessage::test()`) are never stored and never redeliverable. Slack, Telegram, Microsoft Teams, Mattermost, email and inbound tracker webhooks are out of scope.
- Payload content is kept **30 days** (`IntegrationDeliveryPayload` prunable on `created_at` through the existing daily `model:prune`); the delivery row keeps its **90-day** retention and metadata.
- Every content column is encrypted (`message`, `request_headers`, `request_body`, `response_excerpt`). **Never stored:** the signing secret, the webhook URL, the full signature. The stored `X-Skrum-Signature` is `sha256=…` followed by its **last 6 characters**.
- Size limit: when the encoded message plus the request body would exceed **512 KB**, no payload row is written and the delivery shows "Content not kept".
- Response excerpt: at most **2 048 bytes** of the last response body are read and kept; the rest is discarded unread. Address pinning (`CURLOPT_RESOLVE`), `withoutRedirecting()` and the 10 s timeout of spec 8 §4.5 stay unchanged.
- Redelivery: same `id`, `event`, `occurredAt`, `data`; fresh `sentAt` and `X-Skrum-Timestamp`; the webhook's **current** secret and **current** URL after the same `SafeWebhookUrl` checks; `X-Skrum-Delivery: <original message id>` and `X-Skrum-Redelivery: true`; normal share retries (4 tries, backoff 10 s, 60 s, 300 s); counts toward webhook health like any delivery; never changes skrum data and never triggers status sync.
- Eligibility refusals (409, exact messages): "This delivery's content is no longer kept." · "This delivery is still being sent." · "Turn the webhook back on before redelivering." · "This delivery is already being redelivered." A delivery outside this team's webhook log is 404.
- View and redeliver: Owners/Admins only (`Gate::authorize('manageIntegrations', $team)`) before validation and before any lookup; members and guests get 403. Both routes sit in the `EnsureIntegrationProviderEnabled` group under `scopeBindings()`. Throttles: redeliver `throttle:10,1,webhookRedeliveries`; view `throttle:60,1,webhookDeliveries`.
- Payload contents, headers and response excerpts never appear in logs, exception messages, job payloads in plain text, or `failed_jobs` in plain text.
- Every new user-facing string exists in `lang/{en,fr,es,de}.json` (appended at the end of each file, en value = key).
- Migrations are up-only (no `down()`); no new Composer or npm dependency; suite, phpstan (0 errors), pint, type-check and lint (pre-existing failures only in `.devcontainer/devcontainer.json` and `docs/superpowers/*.md`) stay green.
- Never `git add -A`/`git add .`; never stage `.junie/mcp/mcp.json`, `resources/js/actions`, `resources/js/routes` or `.superpowers/`.

## Rulings made while planning (amend the spec in Task 7)

- **R1 — job payloads.** Existing share and event jobs (`DeliverToWebhook`, `DeliverWebhookEvent`) keep spec 8's message parts in their payload; they are `ShouldBeEncrypted`, so `failed_jobs` never holds them in plain text. The new `RedeliverWebhook` job carries only the delivery id and reads the message from the payload row. Changing the existing jobs would rewrite most of `WebhookSharesTest`/`WebhookEventsTest` for no security gain.
- **R2 — size limit.** The limit is checked when the delivery is queued: a message whose encoded size, twice over plus 4 KB of envelope, exceeds 512 KB gets no payload row (the body repeats the message).
- **R3 — which deliveries a team may view.** The webhook log spans reconnections (`WebhookDeliveriesController::index` filters on `team_id` + channel), so `{delivery}` is looked up by `team_id` + channel `webhook`, not by `team_integration_id`. `{delivery}` is a plain string route parameter: `scopeBindings()` has no `TeamIntegration → deliveries` relation.
- **R4 — response excerpt under fakes.** `Http::fake()` responses never pass through curl's write callback, so `ResponseExcerpt::orBodyOf()` falls back to the first 2 048 bytes of `$response->body()`; with real curl that body is empty because the callback discarded it.
- **R5 — content missing at run time** (`WebhookContentMissing`, 409) fails the redelivery without counting toward the automatic disabling.
- **R6 — connection of a redelivery.** The new row's `team_integration_id` is the **current** webhook connection (the one it is sent through), not the original's.

## Review Focus

1. A response excerpt cut in the middle of a multibyte character must not break the view endpoint (JSON encoding) — Task 5 test "shows a response excerpt cut inside a character".
2. Two quick clicks on Redeliver must queue one redelivery and answer 409 to the second — Task 4 test "redelivers a delivery only once at a time".
3. A redelivery after the signing secret was rotated must verify with the new secret — Task 4 test "redelivers the stored message with the same id, a fresh time and the current secret".
4. A delivery made through a previous connection (webhook disconnected and reconnected) must still be viewable and redeliverable through the current one — Task 5 test "redelivers a delivery made through an earlier connection".
5. Members must not read payloads (they contain action item text and names), and another team's delivery id must be 404 — Task 5 tests "keeps payloads to Owners and Admins" and "answers 404 for deliveries outside the team's webhook log".

## File Structure

| Area | Files |
|---|---|
| Schema | Create `database/migrations/2026_10_08_100000_create_integration_delivery_payloads_table.php` |
| Models | Create `app/Models/IntegrationDeliveryPayload.php`, `database/factories/IntegrationDeliveryPayloadFactory.php`; modify `app/Models/IntegrationDelivery.php`; modify `routes/console.php` (prune list) |
| Storing messages | Create `app/Actions/Integrations/StoreWebhookPayload.php`; modify `app/Actions/Integrations/QueueShare.php`, `app/Listeners/QueueWebhookEvents.php` |
| Capturing attempts | Create `app/Support/Integrations/Webhook/{ResponseExcerpt,WebhookRequest}.php`; modify `app/Support/Integrations/Webhook/{WebhookClient,WebhookMessage}.php` |
| Redelivery | Create `app/Jobs/Integrations/{SendsToWebhook,RedeliverWebhook}.php`, `app/Support/Integrations/Exceptions/WebhookContentMissing.php`, `app/Actions/Integrations/RequestWebhookRedelivery.php`; modify `app/Jobs/Integrations/DeliverToWebhook.php` |
| HTTP | Create `app/Actions/Integrations/{FindWebhookDelivery,PresentWebhookDeliveryPayload}.php`, `app/Http/Controllers/Integrations/WebhookRedeliveriesController.php`; modify `app/Http/Controllers/Integrations/WebhookDeliveriesController.php`, `app/Actions/Integrations/PresentWebhookDelivery.php`, `routes/web.php` |
| Frontend | Create `resources/js/components/integrations/webhook-delivery-dialog.tsx`; modify `resources/js/components/integrations/webhook-deliveries-panel.tsx`, `resources/js/types/integrations.ts`, `lang/{en,fr,es,de}.json` |
| Tests | Create `tests/Feature/Integrations/{WebhookPayloadsTest,WebhookRedeliveryTest}.php`; modify `tests/Feature/Integrations/{WebhookSharesTest,WebhookEventsTest,WebhookClientTest}.php` |
| Docs | Modify `docs/superpowers/specs/2026-10-01-webhook-redelivery-design.md` (Task 7) |

---

### Task 1: Payload table, model and pruning

**Files:**
- Create: `database/migrations/2026_10_08_100000_create_integration_delivery_payloads_table.php` (with `vendor/bin/sail artisan make:migration create_integration_delivery_payloads_table --no-interaction`, renamed to the fixed prefix), `app/Models/IntegrationDeliveryPayload.php` (with `vendor/bin/sail artisan make:model IntegrationDeliveryPayload --factory --no-interaction`), `database/factories/IntegrationDeliveryPayloadFactory.php`
- Modify: `app/Models/IntegrationDelivery.php`, `routes/console.php:39`
- Test: create `tests/Feature/Integrations/WebhookPayloadsTest.php`

**Interfaces:**
- Consumes: `IntegrationDelivery`, `IntegrationDeliveryFactory`, `TeamIntegrationFactory::webhook()`.
- Produces: `IntegrationDeliveryPayload` (`RetentionDays = 30`, `delivery()`; properties `message` `array{id: string, event: string, occurredAt: string, data: array<string, mixed>}`, `request_headers` `array<string, string>|null`, `request_body` `?string`, `response_status` `?int`, `response_excerpt` `?string`); `IntegrationDelivery::payload(): HasOne`, `IntegrationDelivery::redeliveryOf(): BelongsTo`, column/property `redelivery_of_id` (`?string`, fillable); Pest helper `webhookPayloadDelivery(array $attributes = []): IntegrationDelivery` (local to `WebhookPayloadsTest.php`).

- [ ] **Step 1: Write the failing test**

Create `tests/Feature/Integrations/WebhookPayloadsTest.php`:

```php
<?php

use App\Enums\IntegrationDeliveryChannel;
use App\Enums\IntegrationDeliveryKind;
use App\Models\IntegrationDelivery;
use App\Models\IntegrationDeliveryPayload;
use App\Models\TeamIntegration;
use Illuminate\Support\Facades\DB;

function webhookPayloadDelivery(array $attributes = []): IntegrationDelivery
{
    $integration = TeamIntegration::factory()->webhook()->create();

    return IntegrationDelivery::factory()->create([
        'team_id' => $integration->team_id,
        'channel' => IntegrationDeliveryChannel::Webhook,
        'kind' => IntegrationDeliveryKind::Event,
        'event' => 'action_item.completed',
        'team_integration_id' => $integration->id,
        'requested_by_user_id' => null,
        ...$attributes,
    ]);
}

/**
 * @return array{id: string, event: string, occurredAt: string, data: array<string, mixed>}
 */
function webhookPayloadMessage(IntegrationDelivery $delivery): array
{
    return [
        'id' => $delivery->id,
        'event' => 'action_item.completed',
        'occurredAt' => '2026-10-08T10:00:00Z',
        'data' => ['actionItem' => ['content' => 'Fix the deploy']],
    ];
}

it('keeps a delivery payload encrypted at rest', function () {
    $delivery = webhookPayloadDelivery();
    $payload = $delivery->payload()->create([
        'message' => webhookPayloadMessage($delivery),
        'request_headers' => ['X-Skrum-Event' => 'action_item.completed'],
        'request_body' => '{"data":{"actionItem":{"content":"Fix the deploy"}}}',
        'response_status' => 500,
        'response_excerpt' => 'Fix the deploy failed',
    ]);

    $raw = DB::table('integration_delivery_payloads')->where('id', $payload->id)->sole();

    expect($raw->message)->not->toContain('Fix the deploy')
        ->and($raw->request_headers)->not->toContain('action_item.completed')
        ->and($raw->request_body)->not->toContain('Fix the deploy')
        ->and($raw->response_excerpt)->not->toContain('Fix the deploy')
        ->and($payload->fresh()->message)->toBe(webhookPayloadMessage($delivery))
        ->and($payload->fresh()->request_headers)->toBe(['X-Skrum-Event' => 'action_item.completed'])
        ->and($payload->fresh()->response_status)->toBe(500)
        ->and($delivery->fresh()->payload->id)->toBe($payload->id);
});

it('prunes payloads after 30 days and keeps their delivery', function () {
    $old = webhookPayloadDelivery();
    $recent = webhookPayloadDelivery();
    $old->payload()->create(['message' => webhookPayloadMessage($old)])->forceFill(['created_at' => now()->subDays(31)])->save();
    $recent->payload()->create(['message' => webhookPayloadMessage($recent)])->forceFill(['created_at' => now()->subDays(29)])->save();

    $this->artisan('model:prune', ['--model' => [IntegrationDeliveryPayload::class]])->assertSuccessful();

    expect($old->fresh())->not->toBeNull()
        ->and($old->payload()->exists())->toBeFalse()
        ->and($recent->payload()->exists())->toBeTrue();
});

it('links a redelivery to its original and drops payloads with their delivery', function () {
    $original = webhookPayloadDelivery();
    $redelivery = webhookPayloadDelivery(['team_id' => $original->team_id, 'redelivery_of_id' => $original->id]);
    $redelivery->payload()->create(['message' => webhookPayloadMessage($original)]);

    expect($redelivery->redeliveryOf->id)->toBe($original->id);

    $redelivery->delete();

    expect(IntegrationDeliveryPayload::query()->count())->toBe(0);

    $original->delete();

    expect(IntegrationDelivery::query()->count())->toBe(0);
});

it('makes a payload for a webhook delivery from its factory', function () {
    $payload = IntegrationDeliveryPayload::factory()->create();

    expect($payload->delivery->channel)->toBe(IntegrationDeliveryChannel::Webhook)
        ->and($payload->message['id'])->toBe($payload->integration_delivery_id);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Integrations/WebhookPayloadsTest.php`
Expected: FAIL — `Class "App\Models\IntegrationDeliveryPayload" not found` / undefined method `payload()`.

- [ ] **Step 3: Write the migration**

Run `vendor/bin/sail artisan make:migration create_integration_delivery_payloads_table --no-interaction`, rename the file to `database/migrations/2026_10_08_100000_create_integration_delivery_payloads_table.php` and replace its content with:

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('integration_delivery_payloads', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('integration_delivery_id')->unique()->constrained()->cascadeOnDelete();
            $table->text('message');
            $table->text('request_headers')->nullable();
            $table->text('request_body')->nullable();
            $table->unsignedSmallInteger('response_status')->nullable();
            $table->text('response_excerpt')->nullable();
            $table->timestamps();

            $table->index('created_at');
        });

        Schema::table('integration_deliveries', function (Blueprint $table) {
            $table->foreignUuid('redelivery_of_id')->nullable()->constrained('integration_deliveries')->nullOnDelete();
        });
    }
};
```

- [ ] **Step 4: Write the model and factory**

Run `vendor/bin/sail artisan make:model IntegrationDeliveryPayload --factory --no-interaction`, then replace `app/Models/IntegrationDeliveryPayload.php` with:

```php
<?php

namespace App\Models;

use Database\Factories\IntegrationDeliveryPayloadFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Prunable;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * What skrum sent for one generic webhook delivery (webhook redelivery
 * spec §3). Every column with content is encrypted; rows are pruned after
 * 30 days while the delivery row itself stays 90 days.
 *
 * @property string $id
 * @property string $integration_delivery_id
 * @property array{id: string, event: string, occurredAt: string, data: array<string, mixed>} $message
 * @property array<string, string>|null $request_headers
 * @property string|null $request_body
 * @property int|null $response_status
 * @property string|null $response_excerpt
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property-read IntegrationDelivery $delivery
 */
#[Fillable(['integration_delivery_id', 'message', 'request_headers', 'request_body', 'response_status', 'response_excerpt'])]
class IntegrationDeliveryPayload extends Model
{
    /** @use HasFactory<IntegrationDeliveryPayloadFactory> */
    use HasFactory;

    use HasUuids;
    use Prunable;

    public const RetentionDays = 30;

    /** @return BelongsTo<IntegrationDelivery, $this> */
    public function delivery(): BelongsTo
    {
        return $this->belongsTo(IntegrationDelivery::class, 'integration_delivery_id');
    }

    /** @return Builder<static> */
    public function prunable(): Builder
    {
        return static::query()->where('created_at', '<', now()->subDays(self::RetentionDays));
    }

    protected function casts(): array
    {
        return [
            'message' => 'encrypted:array',
            'request_headers' => 'encrypted:array',
            'request_body' => 'encrypted',
            'response_status' => 'integer',
            'response_excerpt' => 'encrypted',
        ];
    }
}
```

Replace `database/factories/IntegrationDeliveryPayloadFactory.php` with:

```php
<?php

namespace Database\Factories;

use App\Enums\IntegrationDeliveryChannel;
use App\Enums\IntegrationDeliveryKind;
use App\Models\IntegrationDelivery;
use App\Models\IntegrationDeliveryPayload;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<IntegrationDeliveryPayload>
 */
class IntegrationDeliveryPayloadFactory extends Factory
{
    public function definition(): array
    {
        return [
            'integration_delivery_id' => IntegrationDelivery::factory()->state([
                'channel' => IntegrationDeliveryChannel::Webhook,
                'kind' => IntegrationDeliveryKind::Event,
                'event' => 'action_item.completed',
                'requested_by_user_id' => null,
            ]),
            'message' => fn (array $attributes) => [
                'id' => $attributes['integration_delivery_id'],
                'event' => 'action_item.completed',
                'occurredAt' => '2026-10-08T10:00:00Z',
                'data' => ['actionItem' => ['content' => 'Fix the deploy']],
            ],
        ];
    }
}
```

- [ ] **Step 5: Link deliveries to payloads and redeliveries**

In `app/Models/IntegrationDelivery.php`:

1. Add the imports `use Illuminate\Database\Eloquent\Relations\HasOne;`.
2. In the class docblock, after `@property Carbon|null $last_attempt_at`, add:

```php
 * @property string|null $redelivery_of_id
```

and after `@property-read TeamIntegration|null $integration`, add:

```php
 * @property-read IntegrationDeliveryPayload|null $payload
 * @property-read IntegrationDelivery|null $redeliveryOf
```

3. Append `'redelivery_of_id'` to the `#[Fillable([...])]` list (after `'last_attempt_at'`).
4. After the `integration()` relation, add:

```php
    /** @return HasOne<IntegrationDeliveryPayload, $this> */
    public function payload(): HasOne
    {
        return $this->hasOne(IntegrationDeliveryPayload::class);
    }

    /** @return BelongsTo<IntegrationDelivery, $this> */
    public function redeliveryOf(): BelongsTo
    {
        return $this->belongsTo(self::class, 'redelivery_of_id');
    }
```

- [ ] **Step 6: Prune payloads daily**

In `routes/console.php`, add `use App\Models\IntegrationDeliveryPayload;` and change the `model:prune` line (line 39) to:

```php
Schedule::command('model:prune', ['--model' => [IntegrationDelivery::class, IntegrationDeliveryPayload::class, IntegrationInboundEvent::class]])
```

keeping the chained calls that follow it unchanged.

- [ ] **Step 7: Run tests to verify they pass**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Integrations/WebhookPayloadsTest.php tests/Feature/Integrations/ConnectOutgoingWebhookTest.php`
Expected: PASS.

- [ ] **Step 8: Format, analyse, commit**

```bash
vendor/bin/sail bin pint --dirty --format agent
vendor/bin/sail bin phpstan analyse --no-progress
git add database/migrations/2026_10_08_100000_create_integration_delivery_payloads_table.php app/Models/IntegrationDeliveryPayload.php database/factories/IntegrationDeliveryPayloadFactory.php app/Models/IntegrationDelivery.php routes/console.php tests/Feature/Integrations/WebhookPayloadsTest.php
git commit -m "feat(integrations): keep encrypted webhook delivery payloads for 30 days"
```

---

### Task 2: Store the message when a webhook delivery is queued

**Files:**
- Create: `app/Actions/Integrations/StoreWebhookPayload.php` (with `vendor/bin/sail artisan make:class Actions/Integrations/StoreWebhookPayload --no-interaction`)
- Modify: `app/Actions/Integrations/QueueShare.php`, `app/Listeners/QueueWebhookEvents.php`
- Test: modify `tests/Feature/Integrations/WebhookSharesTest.php`, `tests/Feature/Integrations/WebhookEventsTest.php`, `tests/Feature/Integrations/WebhookPayloadsTest.php`

**Interfaces:**
- Consumes: Task 1 (`IntegrationDelivery::payload()`, `IntegrationDeliveryPayload`).
- Produces: `StoreWebhookPayload::handle(IntegrationDelivery $delivery, array $message): void` (`MaxBytes = 524288`); every webhook share and automatic event has a payload whose `message` equals the job's `deliveryId`/`event`/`occurredAt`/`data`.

- [ ] **Step 1: Write the failing tests**

Append to `tests/Feature/Integrations/WebhookSharesTest.php`:

```php
it('keeps the message of a webhook share for its delivery log', function () {
    [$retro, $facilitator] = webhookSharingRetro();

    $this->actingAs($facilitator)
        ->postJson(route('retros.shares.store', $retro), ['channel' => 'webhook', 'kind' => 'link'])
        ->assertAccepted();

    $delivery = IntegrationDelivery::query()->sole();
    $message = $delivery->payload->message;

    expect($message)->toBe([
        'id' => $delivery->id,
        'event' => 'retro.link',
        'occurredAt' => $message['occurredAt'],
        'data' => ['title' => 'Sprint 42', 'url' => route('retros.show', $retro), 'sharedBy' => 'Fran Facilitator'],
    ]);
    Queue::assertPushed(DeliverToWebhook::class, fn (DeliverToWebhook $job) => $job->occurredAt === $message['occurredAt']
        && $job->data === $message['data']);
});
```

Append to `tests/Feature/Integrations/WebhookEventsTest.php`:

```php
it('keeps the message of an automatic event for its delivery log', function () {
    [$retro, , $participant] = webhookEventRetro();
    subscribedWebhook($retro->team, ['action_item.created']);

    app(CreateActionItem::class)->handle($retro->team, $retro, ActionItemActor::forParticipant($participant), ['content' => 'Fix the deploy']);

    $job = pushedWebhookEvents()->sole();
    $delivery = IntegrationDelivery::query()->sole();

    expect($delivery->payload->message)->toBe([
        'id' => $delivery->id,
        'event' => 'action_item.created',
        'occurredAt' => $job->occurredAt,
        'data' => $job->data,
    ]);
});
```

Append to `tests/Feature/Integrations/WebhookPayloadsTest.php` (add `use App\Actions\Integrations\StoreWebhookPayload;` to its imports):

```php
it('keeps no content for a message too large to store', function () {
    $delivery = webhookPayloadDelivery();
    $message = [...webhookPayloadMessage($delivery), 'data' => ['notes' => str_repeat('a', 260 * 1024)]];

    app(StoreWebhookPayload::class)->handle($delivery, $message);

    expect($delivery->payload()->exists())->toBeFalse();
});

it('keeps a message that fits', function () {
    $delivery = webhookPayloadDelivery();

    app(StoreWebhookPayload::class)->handle($delivery, webhookPayloadMessage($delivery));

    expect($delivery->payload->message)->toBe(webhookPayloadMessage($delivery));
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Integrations/WebhookPayloadsTest.php tests/Feature/Integrations/WebhookSharesTest.php tests/Feature/Integrations/WebhookEventsTest.php`
Expected: FAIL — `StoreWebhookPayload` not found; the two "keeps the message" tests fail on a null `payload`.

- [ ] **Step 3: Write `StoreWebhookPayload`**

Replace `app/Actions/Integrations/StoreWebhookPayload.php` with:

```php
<?php

namespace App\Actions\Integrations;

use App\Models\IntegrationDelivery;

class StoreWebhookPayload
{
    public const MaxBytes = 524288;

    private const EnvelopeBytes = 4096;

    /**
     * Keeps the message of a generic webhook delivery for viewing and
     * redelivery (webhook redelivery spec §3). The body sent later repeats
     * the message, so a message that would not fit twice, with its
     * envelope, in 512 KB is not kept at all.
     *
     * @param  array{id: string, event: string, occurredAt: string, data: array<string, mixed>}  $message
     */
    public function handle(IntegrationDelivery $delivery, array $message): void
    {
        $size = strlen(json_encode($message, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR));

        if ($size * 2 + self::EnvelopeBytes > self::MaxBytes) {
            return;
        }

        $delivery->payload()->create(['message' => $message]);
    }
}
```

- [ ] **Step 4: Store the message of webhook shares**

Replace `app/Actions/Integrations/QueueShare.php` with:

```php
<?php

namespace App\Actions\Integrations;

use App\Contracts\DeliverySubject;
use App\Enums\IntegrationDeliveryChannel;
use App\Enums\IntegrationDeliveryKind;
use App\Enums\IntegrationDeliveryStatus;
use App\Enums\IntegrationProvider;
use App\Jobs\Integrations\DeliverToMattermost;
use App\Jobs\Integrations\DeliverToMicrosoftTeams;
use App\Jobs\Integrations\DeliverToSlack;
use App\Jobs\Integrations\DeliverToTelegram;
use App\Jobs\Integrations\DeliverToWebhook;
use App\Models\IntegrationDelivery;
use App\Models\Team;
use App\Models\TeamIntegration;
use App\Models\User;
use App\Support\Integrations\Exceptions\NotConnected;
use App\Support\Integrations\Messages\ShareContent;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;
use InvalidArgumentException;

class QueueShare
{
    public function __construct(private StoreWebhookPayload $storeWebhookPayload) {}

    public function requireIntegration(Team $team, IntegrationProvider $provider): TeamIntegration
    {
        $integration = $provider->isEnabled() ? $team->integration($provider) : null;

        if ($integration === null) {
            throw new NotConnected($provider);
        }

        $integration->ensureActive();

        return $integration;
    }

    public function handle(
        Model&DeliverySubject $subject,
        IntegrationDeliveryChannel $channel,
        IntegrationDeliveryKind $kind,
        User $requester,
        ShareContent $content,
    ): IntegrationDelivery {
        $provider = $channel->provider() ?? throw new InvalidArgumentException('Email is not a share channel.');
        $team = $subject->deliveryTeam();

        $integration = $this->requireIntegration($team, $provider);
        $locale = app()->getLocale();
        $occurredAt = now()->toIso8601ZuluString();

        $event = $provider === IntegrationProvider::Webhook ? $this->webhookEvent($kind) : null;
        $webhookData = $provider === IntegrationProvider::Webhook ? $content->toWebhook() : [];

        $makeJob = match ($provider) {
            IntegrationProvider::Slack => fn (string $id) => new DeliverToSlack($id, $content->toSlack(), $locale),
            IntegrationProvider::Telegram => fn (string $id) => new DeliverToTelegram($id, $content->toTelegram(), $locale),
            IntegrationProvider::MicrosoftTeams => fn (string $id) => new DeliverToMicrosoftTeams($id, $content->toMicrosoftTeams(), $locale),
            IntegrationProvider::Mattermost => fn (string $id) => new DeliverToMattermost($id, $content->toMattermost(), $locale),
            IntegrationProvider::Webhook => fn (string $id) => new DeliverToWebhook($id, (string) $event, $occurredAt, $webhookData, $locale),
            default => throw new InvalidArgumentException("{$provider->value} is not a share channel."),
        };

        $delivery = DB::transaction(function () use ($team, $channel, $kind, $integration, $event, $subject, $requester, $occurredAt, $webhookData): IntegrationDelivery {
            $delivery = IntegrationDelivery::query()->create([
                'team_id' => $team->id,
                'channel' => $channel,
                'kind' => $kind,
                'team_integration_id' => $integration->id,
                'event' => $event,
                'subject_type' => $subject->getMorphClass(),
                'subject_id' => $subject->getKey(),
                'requested_by_user_id' => $requester->id,
                'status' => IntegrationDeliveryStatus::Queued,
            ]);

            if ($event !== null) {
                $this->storeWebhookPayload->handle($delivery, [
                    'id' => $delivery->id,
                    'event' => $event,
                    'occurredAt' => $occurredAt,
                    'data' => $webhookData,
                ]);
            }

            return $delivery;
        });

        $job = $makeJob($delivery->id);

        dispatch($job)->afterCommit();

        return $delivery;
    }

    private function webhookEvent(IntegrationDeliveryKind $kind): string
    {
        return match ($kind) {
            IntegrationDeliveryKind::RetroLink => 'retro.link',
            IntegrationDeliveryKind::PokerLink => 'poker.link',
            IntegrationDeliveryKind::RetroResults => 'retro.results',
            IntegrationDeliveryKind::GameRoomLink => 'game_room.link',
            IntegrationDeliveryKind::Event => throw new InvalidArgumentException('Automatic events are not shares.'),
        };
    }
}
```

- [ ] **Step 5: Store the message of automatic events**

In `app/Listeners/QueueWebhookEvents.php`:

1. Add the imports `use App\Actions\Integrations\StoreWebhookPayload;` and `use Illuminate\Support\Facades\DB;`.
2. Replace the constructor with:

```php
    public function __construct(
        private BuildWebhookEventData $buildWebhookEventData,
        private StoreWebhookPayload $storeWebhookPayload,
    ) {}
```

3. Replace the whole `try { … }` block of `queue()` (keep the `catch` unchanged) with:

```php
        try {
            $data = $buildData();
            $occurredAt = now()->toIso8601ZuluString();

            $delivery = DB::transaction(function () use ($team, $integration, $event, $subject, $occurredAt, $data): IntegrationDelivery {
                $delivery = IntegrationDelivery::query()->create([
                    'team_id' => $team->id,
                    'channel' => IntegrationDeliveryChannel::Webhook,
                    'kind' => IntegrationDeliveryKind::Event,
                    'team_integration_id' => $integration->id,
                    'event' => $event->value,
                    'subject_type' => $subject->getMorphClass(),
                    'subject_id' => $subject->getKey(),
                    'requested_by_user_id' => null,
                    'status' => IntegrationDeliveryStatus::Queued,
                ]);

                $this->storeWebhookPayload->handle($delivery, [
                    'id' => $delivery->id,
                    'event' => $event->value,
                    'occurredAt' => $occurredAt,
                    'data' => $data,
                ]);

                return $delivery;
            });

            dispatch(new DeliverWebhookEvent($delivery->id, $event->value, $occurredAt, $data, app()->getLocale()))->afterCommit();
        } catch (Throwable $exception) {
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Integrations/WebhookPayloadsTest.php tests/Feature/Integrations/WebhookSharesTest.php tests/Feature/Integrations/WebhookEventsTest.php tests/Feature/Integrations/ChatChannelSharesTest.php tests/Feature/Integrations/QueueShareTest.php`
Expected: PASS.

- [ ] **Step 7: Format, analyse, commit**

```bash
vendor/bin/sail bin pint --dirty --format agent
vendor/bin/sail bin phpstan analyse --no-progress
git add app/Actions/Integrations/StoreWebhookPayload.php app/Actions/Integrations/QueueShare.php app/Listeners/QueueWebhookEvents.php tests/Feature/Integrations/WebhookPayloadsTest.php tests/Feature/Integrations/WebhookSharesTest.php tests/Feature/Integrations/WebhookEventsTest.php
git commit -m "feat(integrations): keep the message of every generic webhook delivery"
```

---

### Task 3: Record each attempt's request and the start of its answer

**Files:**
- Create: `app/Support/Integrations/Webhook/ResponseExcerpt.php`, `app/Support/Integrations/Webhook/WebhookRequest.php` (both with `vendor/bin/sail artisan make:class … --no-interaction`)
- Modify: `app/Support/Integrations/Webhook/WebhookClient.php`, `app/Support/Integrations/Webhook/WebhookMessage.php`
- Test: modify `tests/Feature/Integrations/WebhookClientTest.php`

**Interfaces:**
- Consumes: Task 1 (`IntegrationDelivery::payload`).
- Produces: `WebhookMessage::__construct(string $id, string $event, string $occurredAt, array $data, bool $redelivery = false)`; `WebhookClient::pendingRequest(WebhookTarget $target, ?ResponseExcerpt $excerpt = null): PendingRequest`; `WebhookClient::maskedSignature(string $signature): string`; `ResponseExcerpt` (`MaxBytes = 2048`, `append(string): void`, `value(): string`, `orBodyOf(Response): ?string`); `WebhookRequest(array $headers, string $body)`. After every attempt of a delivery that has a payload, the payload holds `request_headers` (with `Content-Type`, `User-Agent`, the `X-Skrum-*` headers and a masked signature), `request_body`, `response_status` and `response_excerpt`.

- [ ] **Step 1: Write the failing tests**

In `tests/Feature/Integrations/WebhookClientTest.php`, add `use App\Models\IntegrationDeliveryPayload;` and `use App\Support\Integrations\Webhook\ResponseExcerpt;` to the imports, then append:

```php
it('keeps what it sent and the start of the answer for a delivery with a stored message', function () {
    $this->travelTo(Carbon::parse('2026-10-07 10:00:05', 'UTC'));
    Http::fake(['hooks.example.com/*' => Http::response(str_repeat('é', 1500), 500)]);
    $integration = TeamIntegration::factory()->webhook()->create();
    $delivery = outgoingWebhookDelivery($integration);
    $delivery->payload()->create(['message' => [
        'id' => $delivery->id,
        'event' => 'action_item.created',
        'occurredAt' => '2026-10-07T10:00:00Z',
        'data' => [],
    ]]);

    expect(fn () => app(WebhookClient::class)->send($integration, outgoingWebhookMessage($delivery->id), $delivery))
        ->toThrow(ProviderUnavailable::class);

    $payload = $delivery->payload()->sole();
    $sent = Http::recorded()->first()[0];

    expect($payload->request_body)->toBe($sent->body())
        ->and($payload->request_headers)->toBe([
            'Content-Type' => 'application/json',
            'User-Agent' => 'skrum-webhooks/1',
            'X-Skrum-Event' => 'action_item.created',
            'X-Skrum-Delivery' => $delivery->id,
            'X-Skrum-Timestamp' => (string) Carbon::parse('2026-10-07 10:00:05', 'UTC')->getTimestamp(),
            'X-Skrum-Signature' => 'sha256=…'.substr($sent->header('X-Skrum-Signature')[0], -6),
        ])
        ->and($payload->response_status)->toBe(500)
        ->and(strlen((string) $payload->response_excerpt))->toBe(2048)
        ->and((string) $payload->response_excerpt)->toBe(str_repeat('é', 1024));
});

it('stores nothing for a delivery without a stored message or for a test message', function () {
    Http::fake(['hooks.example.com/*' => Http::response('ok', 200)]);
    $integration = TeamIntegration::factory()->webhook()->create();

    app(WebhookClient::class)->send($integration, outgoingWebhookMessage(), outgoingWebhookDelivery($integration));
    app(WebhookClient::class)->send($integration, WebhookMessage::test());

    expect(IntegrationDeliveryPayload::query()->count())->toBe(0);
});

it('marks a redelivered message and only that one', function () {
    Http::fake(['hooks.example.com/*' => Http::response('', 204)]);
    $integration = TeamIntegration::factory()->webhook()->create();

    app(WebhookClient::class)->send($integration, new WebhookMessage('delivery-1', 'action_item.created', '2026-10-07T10:00:00Z', [], redelivery: true));
    app(WebhookClient::class)->send($integration, outgoingWebhookMessage('delivery-2'));

    Http::assertSent(fn (Request $request) => $request->header('X-Skrum-Delivery')[0] === 'delivery-1'
        && $request->header('X-Skrum-Redelivery')[0] === 'true'
        && outgoingWebhookSignatureIsValid($request));
    Http::assertSent(fn (Request $request) => $request->header('X-Skrum-Delivery')[0] === 'delivery-2'
        && ! $request->hasHeader('X-Skrum-Redelivery'));
});

it('keeps only the first 2 KB of the answer it reads', function () {
    $excerpt = new ResponseExcerpt;
    $options = app(WebhookClient::class)
        ->pendingRequest(app(SafeWebhookUrl::class)->resolve(TeamIntegrationFactory::WebhookUrl), $excerpt)
        ->getOptions();

    expect($options['curl'][CURLOPT_WRITEFUNCTION]('handle', str_repeat('a', 1500)))->toBe(1500)
        ->and($options['curl'][CURLOPT_WRITEFUNCTION]('handle', str_repeat('b', 1500)))->toBe(1500)
        ->and($excerpt->value())->toBe(str_repeat('a', 1500).str_repeat('b', 548))
        ->and($options['curl'][CURLOPT_RESOLVE])->toBe(['hooks.example.com:443:93.184.216.34'])
        ->and($options['allow_redirects'])->toBeFalse();
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Integrations/WebhookClientTest.php`
Expected: FAIL — `ResponseExcerpt` not found, unknown named parameter `redelivery`, empty `request_headers`.

- [ ] **Step 3: Add the redelivery flag to `WebhookMessage`**

In `app/Support/Integrations/Webhook/WebhookMessage.php`, replace the constructor with:

```php
    /**
     * @param  array<string, mixed>  $data
     */
    public function __construct(
        public string $id,
        public string $event,
        public string $occurredAt,
        public array $data,
        public bool $redelivery = false,
    ) {}
```

- [ ] **Step 4: Write `ResponseExcerpt` and `WebhookRequest`**

Replace `app/Support/Integrations/Webhook/ResponseExcerpt.php` with:

```php
<?php

namespace App\Support\Integrations\Webhook;

use Illuminate\Http\Client\Response;

/**
 * The first 2 KB of a receiver's answer, collected while curl discards
 * the rest unread (webhook redelivery spec §4.1).
 */
class ResponseExcerpt
{
    public const MaxBytes = 2048;

    private string $value = '';

    public function append(string $chunk): void
    {
        $room = self::MaxBytes - strlen($this->value);

        if ($room <= 0) {
            return;
        }

        $this->value .= substr($chunk, 0, $room);
    }

    public function value(): string
    {
        return $this->value;
    }

    /**
     * Faked responses never pass through curl's write callback, so their
     * body stands in for what curl would have collected.
     */
    public function orBodyOf(Response $response): ?string
    {
        $excerpt = $this->value !== '' ? $this->value : substr($response->body(), 0, self::MaxBytes);

        return $excerpt === '' ? null : $excerpt;
    }
}
```

Replace `app/Support/Integrations/Webhook/WebhookRequest.php` with:

```php
<?php

namespace App\Support\Integrations\Webhook;

class WebhookRequest
{
    /**
     * @param  array<string, string>  $headers
     */
    public function __construct(
        public array $headers,
        public string $body,
    ) {}
}
```

- [ ] **Step 5: Capture attempts in `WebhookClient`**

In `app/Support/Integrations/Webhook/WebhookClient.php`:

1. Add the constant `private const MaskedSignatureLength = 6;` after `TooManyRequestsStatus`.
2. Replace `send()` with:

```php
    public function send(TeamIntegration $integration, WebhookMessage $message, ?IntegrationDelivery $delivery = null): void
    {
        $integration->withReconnectHandling(function () use ($integration, $message, $delivery): void {
            $request = null;
            $response = null;
            $excerpt = new ResponseExcerpt;

            try {
                $target = $this->target($integration);
                $request = $this->request($message, $integration, $this->secret($integration));
                $response = $this->post($target, $request, $excerpt);
            } finally {
                if ($delivery !== null) {
                    $this->recordAttempt($delivery, $response?->status());
                    $this->capture($delivery, $request, $response, $excerpt);
                }
            }

            $this->handleAnswer($integration, $response, $delivery !== null);
        });
    }
```

3. Replace `pendingRequest()` with:

```php
    public function pendingRequest(WebhookTarget $target, ?ResponseExcerpt $excerpt = null): PendingRequest
    {
        $request = ProviderHttp::request(self::TimeoutSeconds)
            ->withoutRedirecting()
            ->withUserAgent(self::UserAgent);

        $curl = [CURLOPT_WRITEFUNCTION => static function ($handle, string $chunk) use ($excerpt): int {
            $excerpt?->append($chunk);

            return strlen($chunk);
        }];
        $resolve = $target->pinnedResolve();

        if ($resolve !== null) {
            $curl[CURLOPT_RESOLVE] = [$resolve];
        }

        return $request->withOptions(['curl' => $curl]);
    }

    public static function maskedSignature(string $signature): string
    {
        return 'sha256=…'.substr($signature, -self::MaskedSignatureLength);
    }
```

4. Replace `post()` with these two methods:

```php
    private function request(WebhookMessage $message, TeamIntegration $integration, string $secret): WebhookRequest
    {
        $sentAt = now();
        $timestamp = $sentAt->getTimestamp();
        $body = $message->body($integration->team, $sentAt);

        $headers = [
            'X-Skrum-Event' => $message->event,
            'X-Skrum-Delivery' => $message->id,
            'X-Skrum-Timestamp' => (string) $timestamp,
            'X-Skrum-Signature' => self::signature($secret, $timestamp, $body),
        ];

        if ($message->redelivery) {
            $headers['X-Skrum-Redelivery'] = 'true';
        }

        return new WebhookRequest($headers, $body);
    }

    private function post(WebhookTarget $target, WebhookRequest $request, ResponseExcerpt $excerpt): Response
    {
        try {
            return $this->pendingRequest($target, $excerpt)
                ->withHeaders($request->headers)
                ->withBody($request->body, 'application/json')
                ->post($target->url);
        } catch (ConnectionException) {
            throw new ProviderUnavailable(IntegrationProvider::Webhook, __('Could not reach :host.', ['host' => $target->host]), timedOut: true);
        }
    }
```

5. After `recordAttempt()`, add:

```php
    private function capture(IntegrationDelivery $delivery, ?WebhookRequest $request, ?Response $response, ResponseExcerpt $excerpt): void
    {
        $payload = $delivery->payload;

        if ($payload === null || $request === null) {
            return;
        }

        $payload->forceFill([
            'request_headers' => [
                'Content-Type' => 'application/json',
                'User-Agent' => self::UserAgent,
                ...$request->headers,
                'X-Skrum-Signature' => self::maskedSignature($request->headers['X-Skrum-Signature']),
            ],
            'request_body' => $request->body,
            'response_status' => $response?->status(),
            'response_excerpt' => $response === null ? null : $excerpt->orBodyOf($response),
        ])->save();
    }
```

6. Update the class docblock's last sentence to: "…redirects are refused and only the status code and the first 2 KB of the answer are read."

- [ ] **Step 6: Run tests to verify they pass**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Integrations/WebhookClientTest.php tests/Feature/Integrations/WebhookSharesTest.php tests/Feature/Integrations/WebhookEventsTest.php tests/Feature/Integrations/ConnectOutgoingWebhookTest.php`
Expected: PASS (the existing "discards the response body instead of buffering it" test still passes: the callback still returns the chunk length).

- [ ] **Step 7: Format, analyse, commit**

```bash
vendor/bin/sail bin pint --dirty --format agent
vendor/bin/sail bin phpstan analyse --no-progress
git add app/Support/Integrations/Webhook/ResponseExcerpt.php app/Support/Integrations/Webhook/WebhookRequest.php app/Support/Integrations/Webhook/WebhookClient.php app/Support/Integrations/Webhook/WebhookMessage.php tests/Feature/Integrations/WebhookClientTest.php
git commit -m "feat(integrations): record what each webhook attempt sent and the start of its answer"
```

---

### Task 4: The redelivery job and the redelivery action

**Files:**
- Create: `app/Jobs/Integrations/SendsToWebhook.php` (with `vendor/bin/sail artisan make:trait Jobs/Integrations/SendsToWebhook --no-interaction`), `app/Jobs/Integrations/RedeliverWebhook.php` (with `vendor/bin/sail artisan make:job Integrations/RedeliverWebhook --no-interaction`), `app/Support/Integrations/Exceptions/WebhookContentMissing.php`, `app/Actions/Integrations/RequestWebhookRedelivery.php` (with `make:class`)
- Modify: `app/Jobs/Integrations/DeliverToWebhook.php`
- Test: create `tests/Feature/Integrations/WebhookRedeliveryTest.php`

**Interfaces:**
- Consumes: Tasks 1–3 (`IntegrationDeliveryPayload`, `IntegrationDelivery::payload()`/`redelivery_of_id`, `WebhookMessage(..., redelivery: true)`), `WebhookClient::send()`, `WebhookHealth::failed()`, `DeliverToChannel`.
- Produces: trait `SendsToWebhook` (`abstract protected function message(): WebhookMessage`); `RedeliverWebhook(string $deliveryId, string $locale)`; `WebhookContentMissing` (409, "This delivery's content is no longer kept."); `RequestWebhookRedelivery::handle(TeamIntegration $integration, IntegrationDelivery $original, User $requester): IntegrationDelivery`; Pest helper `redeliverableWebhookDelivery(IntegrationDeliveryStatus $status = IntegrationDeliveryStatus::Failed): array{0: Team, 1: User, 2: TeamIntegration, 3: IntegrationDelivery}` (local to `WebhookRedeliveryTest.php`).

- [ ] **Step 1: Write the failing test**

Create `tests/Feature/Integrations/WebhookRedeliveryTest.php`:

```php
<?php

use App\Actions\Integrations\RequestWebhookRedelivery;
use App\Enums\IntegrationDeliveryChannel;
use App\Enums\IntegrationDeliveryKind;
use App\Enums\IntegrationDeliveryStatus;
use App\Enums\IntegrationProvider;
use App\Enums\IntegrationStatus;
use App\Jobs\Integrations\PushActionItemState;
use App\Jobs\Integrations\RedeliverWebhook;
use App\Models\IntegrationDelivery;
use App\Models\Team;
use App\Models\TeamIntegration;
use App\Models\User;
use Database\Factories\TeamIntegrationFactory;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Queue;
use Symfony\Component\HttpKernel\Exception\HttpException;

beforeEach(function () {
    Http::preventStrayRequests();
    Queue::fake();
    enableIntegrations(IntegrationProvider::Webhook);
    outgoingWebhookResolves();
});

/**
 * @return array{0: Team, 1: User, 2: TeamIntegration, 3: IntegrationDelivery}
 */
function redeliverableWebhookDelivery(IntegrationDeliveryStatus $status = IntegrationDeliveryStatus::Failed): array
{
    $team = Team::factory()->create(['name' => 'Platform']);
    $admin = integrationAdmin($team);
    $integration = TeamIntegration::factory()->webhook()->create(['team_id' => $team->id]);
    $delivery = IntegrationDelivery::factory()->create([
        'team_id' => $team->id,
        'channel' => IntegrationDeliveryChannel::Webhook,
        'kind' => IntegrationDeliveryKind::Event,
        'event' => 'action_item.completed',
        'team_integration_id' => $integration->id,
        'requested_by_user_id' => null,
        'status' => $status,
        'attempts' => 7,
        'response_status' => 503,
    ]);
    $delivery->payload()->create(['message' => [
        'id' => $delivery->id,
        'event' => 'action_item.completed',
        'occurredAt' => '2026-10-07T10:00:00Z',
        'data' => ['actionItem' => ['id' => 'item-1', 'content' => 'Fix the deploy']],
    ]]);

    return [$team, $admin, $integration, $delivery];
}

function expectRedeliveryRefused(Closure $redeliver, string $message): void
{
    try {
        $redeliver();
    } catch (HttpException $exception) {
        expect($exception->getStatusCode())->toBe(409)
            ->and($exception->getMessage())->toBe($message);

        return;
    }

    test()->fail('The redelivery was not refused.');
}

it('redelivers the stored message with the same id, a fresh time and the current secret', function () {
    $this->travelTo(Carbon::parse('2026-10-08 09:00:00', 'UTC'));
    [, $admin, $integration, $delivery] = redeliverableWebhookDelivery();
    $integration->forceFill(['credentials' => ['url' => TeamIntegrationFactory::WebhookUrl, 'webhookSecret' => 'rotated-secret']])->save();

    $redelivery = app(RequestWebhookRedelivery::class)->handle($integration, $delivery, $admin);

    expect($redelivery->redelivery_of_id)->toBe($delivery->id)
        ->and($redelivery->kind)->toBe(IntegrationDeliveryKind::Event)
        ->and($redelivery->event)->toBe('action_item.completed')
        ->and($redelivery->team_integration_id)->toBe($integration->id)
        ->and($redelivery->requested_by_user_id)->toBe($admin->id)
        ->and($redelivery->status)->toBe(IntegrationDeliveryStatus::Queued)
        ->and($redelivery->payload->message)->toBe($delivery->payload->message);

    $job = Queue::pushed(RedeliverWebhook::class)->sole();

    expect(serialize($job))->not->toContain('Fix the deploy');

    Http::fake(['hooks.example.com/*' => Http::response('', 204)]);
    runOutgoingWebhookJob($job)->assertNotFailed();

    Http::assertSent(function (Request $request) use ($delivery) {
        $body = json_decode($request->body(), true);

        return $request->header('X-Skrum-Delivery')[0] === $delivery->id
            && $request->header('X-Skrum-Redelivery')[0] === 'true'
            && outgoingWebhookSignatureIsValid($request, 'rotated-secret')
            && $body['id'] === $delivery->id
            && $body['occurredAt'] === '2026-10-07T10:00:00Z'
            && $body['sentAt'] === '2026-10-08T09:00:00Z'
            && $body['data'] === ['actionItem' => ['id' => 'item-1', 'content' => 'Fix the deploy']];
    });
    expect($redelivery->fresh()->status)->toBe(IntegrationDeliveryStatus::Sent)
        ->and($redelivery->payload()->sole()->request_headers['X-Skrum-Redelivery'])->toBe('true')
        ->and($delivery->fresh()->status)->toBe(IntegrationDeliveryStatus::Failed)
        ->and($delivery->fresh()->attempts)->toBe(7);
    Queue::assertNotPushed(PushActionItemState::class);
});

it('refuses a delivery it cannot redeliver', function (string $case, string $message) {
    [, $admin, $integration, $delivery] = redeliverableWebhookDelivery();

    match ($case) {
        'pruned' => $delivery->payload()->delete(),
        'queued' => $delivery->forceFill(['status' => IntegrationDeliveryStatus::Queued])->save(),
        'disabled' => $integration->markReconnectRequired('Disabled after 10 failed deliveries in a row.'),
    };

    expectRedeliveryRefused(fn () => app(RequestWebhookRedelivery::class)->handle($integration->fresh(), $delivery->fresh(), $admin), $message);

    Queue::assertNotPushed(RedeliverWebhook::class);
    expect(IntegrationDelivery::query()->count())->toBe(1);
})->with([
    'content pruned' => ['pruned', "This delivery's content is no longer kept."],
    'still being sent' => ['queued', 'This delivery is still being sent.'],
    'webhook disabled' => ['disabled', 'Turn the webhook back on before redelivering.'],
]);

it('redelivers a delivery only once at a time', function () {
    [, $admin, $integration, $delivery] = redeliverableWebhookDelivery();

    app(RequestWebhookRedelivery::class)->handle($integration, $delivery, $admin);

    expectRedeliveryRefused(fn () => app(RequestWebhookRedelivery::class)->handle($integration, $delivery, $admin), 'This delivery is already being redelivered.');

    Queue::assertPushed(RedeliverWebhook::class, 1);
    expect(IntegrationDelivery::query()->whereNotNull('redelivery_of_id')->count())->toBe(1);
});

it('counts a failed redelivery toward disabling the webhook', function () {
    Http::fake(['hooks.example.com/*' => Http::response('', 404)]);
    [, $admin, $integration, $delivery] = redeliverableWebhookDelivery();
    $integration->forceFill(['consecutive_failures' => 9])->save();

    app(RequestWebhookRedelivery::class)->handle($integration, $delivery, $admin);
    runOutgoingWebhookJob(Queue::pushed(RedeliverWebhook::class)->sole())->assertFailed();

    expect($integration->fresh()->consecutive_failures)->toBe(10)
        ->and($integration->fresh()->status)->toBe(IntegrationStatus::ReconnectRequired);
});

it('fails a redelivery to an endpoint that became unsafe without touching the original', function () {
    [, $admin, $integration, $delivery] = redeliverableWebhookDelivery();

    app(RequestWebhookRedelivery::class)->handle($integration, $delivery, $admin);
    outgoingWebhookResolves(['10.0.0.5']);
    runOutgoingWebhookJob(Queue::pushed(RedeliverWebhook::class)->sole())->assertFailed();

    $redelivery = IntegrationDelivery::query()->whereNotNull('redelivery_of_id')->sole();

    expect($redelivery->status)->toBe(IntegrationDeliveryStatus::Failed)
        ->and($redelivery->error)->toBe('This webhook URL points to a private or invalid address.')
        ->and($delivery->fresh()->status)->toBe(IntegrationDeliveryStatus::Failed)
        ->and($delivery->fresh()->error)->toBeNull();
    Http::assertNothingSent();
});

it('fails a redelivery whose content disappeared without counting it', function () {
    [, $admin, $integration, $delivery] = redeliverableWebhookDelivery();

    $redelivery = app(RequestWebhookRedelivery::class)->handle($integration, $delivery, $admin);
    $redelivery->payload()->delete();
    runOutgoingWebhookJob(Queue::pushed(RedeliverWebhook::class)->sole())->assertFailed();

    expect($redelivery->fresh()->status)->toBe(IntegrationDeliveryStatus::Failed)
        ->and($redelivery->fresh()->error)->toBe("This delivery's content is no longer kept.")
        ->and($integration->fresh()->consecutive_failures)->toBe(0);
    Http::assertNothingSent();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Integrations/WebhookRedeliveryTest.php`
Expected: FAIL — `Class "App\Actions\Integrations\RequestWebhookRedelivery" not found`.

- [ ] **Step 3: Write `WebhookContentMissing`**

Create `app/Support/Integrations/Exceptions/WebhookContentMissing.php`:

```php
<?php

namespace App\Support\Integrations\Exceptions;

use App\Enums\IntegrationProvider;

class WebhookContentMissing extends IntegrationException
{
    public function __construct()
    {
        parent::__construct(IntegrationProvider::Webhook);
    }

    public function status(): int
    {
        return 409;
    }

    public function userMessage(): string
    {
        return __('This delivery\'s content is no longer kept.');
    }
}
```

- [ ] **Step 4: Share the webhook sending code in a trait**

Replace `app/Jobs/Integrations/SendsToWebhook.php` with:

```php
<?php

namespace App\Jobs\Integrations;

use App\Enums\IntegrationProvider;
use App\Models\IntegrationDelivery;
use App\Models\TeamIntegration;
use App\Support\Integrations\Exceptions\NotConnected;
use App\Support\Integrations\Exceptions\WebhookContentMissing;
use App\Support\Integrations\Exceptions\WebhookDisabled;
use App\Support\Integrations\Webhook\WebhookClient;
use App\Support\Integrations\Webhook\WebhookHealth;
use App\Support\Integrations\Webhook\WebhookMessage;
use Throwable;

/**
 * Posts one message to the team's generic webhook; the URL and secret are
 * read from the database at run time. A delivery that ends failed while
 * the webhook is active counts toward the automatic disabling (spec 8 §4.7).
 */
trait SendsToWebhook
{
    abstract protected function message(): WebhookMessage;

    protected function provider(): IntegrationProvider
    {
        return IntegrationProvider::Webhook;
    }

    protected function integration(IntegrationDelivery $delivery): TeamIntegration
    {
        $integration = IntegrationProvider::Webhook->isEnabled() ? $delivery->team->integration(IntegrationProvider::Webhook) : null;

        if ($integration === null) {
            throw new NotConnected(IntegrationProvider::Webhook);
        }

        if (! $integration->isActive()) {
            throw new WebhookDisabled;
        }

        return $integration;
    }

    protected function send(TeamIntegration $integration): void
    {
        $message = $this->message();
        $delivery = IntegrationDelivery::query()->with('payload')->findOrFail($this->deliveryId);

        app(WebhookClient::class)->send($integration, $message, $delivery);
    }

    protected function afterFailure(IntegrationDelivery $delivery, ?Throwable $exception): void
    {
        if ($exception instanceof NotConnected || $exception instanceof WebhookDisabled || $exception instanceof WebhookContentMissing) {
            return;
        }

        $integration = $delivery->team->integration(IntegrationProvider::Webhook);

        if ($integration === null) {
            return;
        }

        app(WebhookHealth::class)->failed($integration);
    }
}
```

Replace `app/Jobs/Integrations/DeliverToWebhook.php` with:

```php
<?php

namespace App\Jobs\Integrations;

use App\Support\Integrations\Webhook\WebhookMessage;

/**
 * Posts one pre-built webhook body (spec 8 §4.5). The job is encrypted on
 * the queue, so its message never reaches a failed-job record in clear.
 */
class DeliverToWebhook extends DeliverToChannel
{
    use SendsToWebhook;

    /**
     * @param  array<string, mixed>  $data
     */
    public function __construct(
        string $deliveryId,
        public string $event,
        public string $occurredAt,
        public array $data,
        string $locale,
    ) {
        parent::__construct($deliveryId, $locale);
    }

    protected function message(): WebhookMessage
    {
        return new WebhookMessage($this->deliveryId, $this->event, $this->occurredAt, $this->data);
    }
}
```

- [ ] **Step 5: Write `RedeliverWebhook`**

Replace `app/Jobs/Integrations/RedeliverWebhook.php` with:

```php
<?php

namespace App\Jobs\Integrations;

use App\Models\IntegrationDelivery;
use App\Models\IntegrationDeliveryPayload;
use App\Support\Integrations\Exceptions\WebhookContentMissing;
use App\Support\Integrations\Webhook\WebhookMessage;

/**
 * Sends a stored webhook message again (webhook redelivery spec §4.2).
 * Only the delivery id travels through the queue; the message is read
 * from the delivery's encrypted payload when the job runs.
 */
class RedeliverWebhook extends DeliverToChannel
{
    use SendsToWebhook;

    protected function message(): WebhookMessage
    {
        $payload = IntegrationDeliveryPayload::query()->where('integration_delivery_id', $this->deliveryId)->first();

        if ($payload === null) {
            throw new WebhookContentMissing;
        }

        $message = $payload->message;

        return new WebhookMessage($message['id'], $message['event'], $message['occurredAt'], $message['data'], redelivery: true);
    }

    protected function announce(IntegrationDelivery $delivery): void {}
}
```

- [ ] **Step 6: Write `RequestWebhookRedelivery`**

Replace `app/Actions/Integrations/RequestWebhookRedelivery.php` with:

```php
<?php

namespace App\Actions\Integrations;

use App\Enums\IntegrationDeliveryStatus;
use App\Jobs\Integrations\RedeliverWebhook;
use App\Models\IntegrationDelivery;
use App\Models\TeamIntegration;
use App\Models\User;
use Illuminate\Support\Facades\DB;

class RequestWebhookRedelivery
{
    /**
     * Queues a past generic webhook delivery again (webhook redelivery spec
     * §4.2–§4.3). The original row is locked so two quick clicks cannot
     * queue two redeliveries of it.
     */
    public function handle(TeamIntegration $integration, IntegrationDelivery $original, User $requester): IntegrationDelivery
    {
        return DB::transaction(function () use ($integration, $original, $requester): IntegrationDelivery {
            $locked = IntegrationDelivery::query()->with('payload')->lockForUpdate()->findOrFail($original->id);
            $payload = $locked->payload;

            if ($payload === null) {
                abort(409, __('This delivery\'s content is no longer kept.'));
            }

            if ($locked->status === IntegrationDeliveryStatus::Queued) {
                abort(409, __('This delivery is still being sent.'));
            }

            if (! $integration->isActive()) {
                abort(409, __('Turn the webhook back on before redelivering.'));
            }

            $alreadyQueued = IntegrationDelivery::query()
                ->where('redelivery_of_id', $locked->id)
                ->where('status', IntegrationDeliveryStatus::Queued->value)
                ->exists();

            if ($alreadyQueued) {
                abort(409, __('This delivery is already being redelivered.'));
            }

            $redelivery = IntegrationDelivery::query()->create([
                'team_id' => $locked->team_id,
                'channel' => $locked->channel,
                'kind' => $locked->kind,
                'event' => $locked->event,
                'team_integration_id' => $integration->id,
                'subject_type' => $locked->subject_type,
                'subject_id' => $locked->subject_id,
                'requested_by_user_id' => $requester->id,
                'status' => IntegrationDeliveryStatus::Queued,
                'redelivery_of_id' => $locked->id,
            ]);

            $redelivery->payload()->create(['message' => $payload->message]);

            dispatch(new RedeliverWebhook($redelivery->id, app()->getLocale()))->afterCommit();

            return $redelivery;
        });
    }
}
```

- [ ] **Step 7: Add the backend strings**

Append to `lang/en.json` (before the closing `}`, adding a comma to the previous last line):

```json
    "This delivery's content is no longer kept.": "This delivery's content is no longer kept.",
    "This delivery is still being sent.": "This delivery is still being sent.",
    "Turn the webhook back on before redelivering.": "Turn the webhook back on before redelivering.",
    "This delivery is already being redelivered.": "This delivery is already being redelivered."
```

`lang/fr.json`:

```json
    "This delivery's content is no longer kept.": "Le contenu de cet envoi n'est plus conservé.",
    "This delivery is still being sent.": "Cet envoi est encore en cours.",
    "Turn the webhook back on before redelivering.": "Réactivez le webhook avant de renvoyer.",
    "This delivery is already being redelivered.": "Cet envoi est déjà en cours de renvoi."
```

`lang/es.json`:

```json
    "This delivery's content is no longer kept.": "El contenido de este envío ya no se conserva.",
    "This delivery is still being sent.": "Este envío todavía se está enviando.",
    "Turn the webhook back on before redelivering.": "Vuelve a activar el webhook antes de reenviar.",
    "This delivery is already being redelivered.": "Este envío ya se está reenviando."
```

`lang/de.json`:

```json
    "This delivery's content is no longer kept.": "Der Inhalt dieser Zustellung wird nicht mehr aufbewahrt.",
    "This delivery is still being sent.": "Diese Zustellung wird noch gesendet.",
    "Turn the webhook back on before redelivering.": "Aktiviere den Webhook wieder, bevor du erneut zustellst.",
    "This delivery is already being redelivered.": "Diese Zustellung wird bereits erneut gesendet."
```

- [ ] **Step 8: Run tests to verify they pass**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Integrations/WebhookRedeliveryTest.php tests/Feature/Integrations/WebhookSharesTest.php tests/Feature/Integrations/WebhookEventsTest.php tests/Feature/Integrations/WebhookClientTest.php tests/Feature/TranslationKeysTest.php`
Expected: PASS.

- [ ] **Step 9: Format, analyse, commit**

```bash
vendor/bin/sail bin pint --dirty --format agent
vendor/bin/sail bin phpstan analyse --no-progress
git add app/Jobs/Integrations/SendsToWebhook.php app/Jobs/Integrations/RedeliverWebhook.php app/Jobs/Integrations/DeliverToWebhook.php app/Support/Integrations/Exceptions/WebhookContentMissing.php app/Actions/Integrations/RequestWebhookRedelivery.php tests/Feature/Integrations/WebhookRedeliveryTest.php lang/en.json lang/fr.json lang/es.json lang/de.json
git commit -m "feat(integrations): redeliver a stored generic webhook delivery"
```

---

### Task 5: View and redeliver endpoints

**Files:**
- Create: `app/Actions/Integrations/FindWebhookDelivery.php`, `app/Actions/Integrations/PresentWebhookDeliveryPayload.php` (both with `make:class`), `app/Http/Controllers/Integrations/WebhookRedeliveriesController.php` (with `vendor/bin/sail artisan make:controller Integrations/WebhookRedeliveriesController --no-interaction`)
- Modify: `app/Http/Controllers/Integrations/WebhookDeliveriesController.php`, `app/Actions/Integrations/PresentWebhookDelivery.php`, `routes/web.php` (after the `teams.integrations.deliveries.index` route, ~line 290)
- Test: modify `tests/Feature/Integrations/WebhookRedeliveryTest.php`

**Interfaces:**
- Consumes: Task 4 (`RequestWebhookRedelivery`, `redeliverableWebhookDelivery()`), `PresentWebhookDelivery`.
- Produces: routes `teams.integrations.deliveries.show` (`GET …/integrations/{integration}/deliveries/{delivery}`) and `teams.integrations.deliveries.redelivery.store` (`POST …/integrations/{integration}/deliveries/{delivery}/redelivery`, 202 with the presented new delivery); Wayfinder `WebhookDeliveriesController.show`, `WebhookRedeliveriesController.store`; list rows gain `hasContent: bool` and `redeliveryOf: string|null`; the view returns `{id, event, status, attempts, redeliveryOf, request: {headers, body}, response: {status, excerpt}}`.

- [ ] **Step 1: Write the failing tests**

Append to `tests/Feature/Integrations/WebhookRedeliveryTest.php` (add `use App\Models\IntegrationDeliveryPayload;` to its imports):

```php
it('shows an Owner or Admin what was sent and answered', function () {
    [$team, $admin, $integration, $delivery] = redeliverableWebhookDelivery();
    $delivery->payload->forceFill([
        'request_headers' => ['X-Skrum-Event' => 'action_item.completed', 'X-Skrum-Signature' => 'sha256=…a1b2c3'],
        'request_body' => '{"id":"x"}',
        'response_status' => 503,
        'response_excerpt' => 'Service Unavailable',
    ])->save();

    $this->actingAs($admin)
        ->getJson(route('teams.integrations.deliveries.show', [$team->workspace, $team, $integration, $delivery->id]))
        ->assertOk()
        ->assertExactJson([
            'id' => $delivery->id,
            'event' => 'action_item.completed',
            'status' => 'failed',
            'attempts' => 7,
            'redeliveryOf' => null,
            'request' => [
                'headers' => ['X-Skrum-Event' => 'action_item.completed', 'X-Skrum-Signature' => 'sha256=…a1b2c3'],
                'body' => '{"id":"x"}',
            ],
            'response' => ['status' => 503, 'excerpt' => 'Service Unavailable'],
        ]);
});

it('shows a response excerpt cut inside a character', function () {
    [$team, $admin, $integration, $delivery] = redeliverableWebhookDelivery();
    $delivery->payload->forceFill(['response_status' => 500, 'response_excerpt' => 'Erreur '.substr('é', 0, 1)])->save();

    $this->actingAs($admin)
        ->getJson(route('teams.integrations.deliveries.show', [$team->workspace, $team, $integration, $delivery->id]))
        ->assertOk()
        ->assertJsonPath('response.excerpt', 'Erreur ?');
});

it('keeps payloads to Owners and Admins', function () {
    [$team, , $integration, $delivery] = redeliverableWebhookDelivery();
    $member = teamMember($team);

    $this->actingAs($member)
        ->getJson(route('teams.integrations.deliveries.show', [$team->workspace, $team, $integration, $delivery->id]))
        ->assertForbidden();
    $this->actingAs($member)
        ->postJson(route('teams.integrations.deliveries.redelivery.store', [$team->workspace, $team, $integration, $delivery->id]))
        ->assertForbidden();

    Queue::assertNotPushed(RedeliverWebhook::class);
});

it('answers 404 for deliveries outside the team\'s webhook log', function () {
    [$team, $admin, $integration, $delivery] = redeliverableWebhookDelivery();
    [, , , $foreign] = redeliverableWebhookDelivery();
    $slack = IntegrationDelivery::factory()->create(['team_id' => $team->id, 'channel' => IntegrationDeliveryChannel::Slack]);
    $show = fn (string $id) => route('teams.integrations.deliveries.show', [$team->workspace, $team, $integration, $id]);

    $this->actingAs($admin)->getJson($show($foreign->id))->assertNotFound();
    $this->actingAs($admin)->getJson($show($slack->id))->assertNotFound();
    $this->actingAs($admin)
        ->postJson(route('teams.integrations.deliveries.redelivery.store', [$team->workspace, $team, $integration, $foreign->id]))
        ->assertNotFound();

    $delivery->payload()->delete();

    $this->actingAs($admin)->getJson($show($delivery->id))->assertNotFound();

    config(['services.outgoing_webhooks.enabled' => false]);

    $this->actingAs($admin)->getJson($show($delivery->id))->assertNotFound();
});

it('redelivers through the endpoint and lists the redelivery', function () {
    [$team, $admin, $integration, $delivery] = redeliverableWebhookDelivery();
    $this->travel(5)->seconds();

    $response = $this->actingAs($admin)
        ->postJson(route('teams.integrations.deliveries.redelivery.store', [$team->workspace, $team, $integration, $delivery->id]))
        ->assertAccepted()
        ->assertJson(['event' => 'action_item.completed', 'status' => 'queued', 'redeliveryOf' => $delivery->id, 'hasContent' => true]);

    $this->actingAs($admin)
        ->postJson(route('teams.integrations.deliveries.redelivery.store', [$team->workspace, $team, $integration, $delivery->id]))
        ->assertConflict()
        ->assertJson(['message' => 'This delivery is already being redelivered.']);

    $this->actingAs($admin)
        ->getJson(route('teams.integrations.deliveries.index', [$team->workspace, $team, $integration]))
        ->assertOk()
        ->assertJsonPath('data.0.id', $response->json('id'))
        ->assertJsonPath('data.0.redeliveryOf', $delivery->id)
        ->assertJsonPath('data.0.hasContent', true)
        ->assertJsonPath('data.1.id', $delivery->id)
        ->assertJsonPath('data.1.hasContent', true);
    Queue::assertPushed(RedeliverWebhook::class, 1);
});

it('redelivers a delivery made through an earlier connection', function () {
    [$team, $admin, $integration, $delivery] = redeliverableWebhookDelivery();
    $integration->delete();
    $current = TeamIntegration::factory()->webhook()->create(['team_id' => $team->id]);

    $this->actingAs($admin)
        ->getJson(route('teams.integrations.deliveries.show', [$team->workspace, $team, $current, $delivery->id]))
        ->assertOk();
    $this->actingAs($admin)
        ->postJson(route('teams.integrations.deliveries.redelivery.store', [$team->workspace, $team, $current, $delivery->id]))
        ->assertAccepted();

    expect(IntegrationDelivery::query()->whereNotNull('redelivery_of_id')->sole()->team_integration_id)->toBe($current->id);
});

it('throttles redeliveries per user', function () {
    [$team, $admin, $integration] = redeliverableWebhookDelivery();
    $url = fn (IntegrationDelivery $delivery) => route('teams.integrations.deliveries.redelivery.store', [$team->workspace, $team, $integration, $delivery->id]);
    $deliveries = collect(range(1, 11))->map(function () use ($team, $integration) {
        $delivery = IntegrationDelivery::factory()->failed()->create([
            'team_id' => $team->id,
            'channel' => IntegrationDeliveryChannel::Webhook,
            'kind' => IntegrationDeliveryKind::Event,
            'event' => 'action_item.completed',
            'team_integration_id' => $integration->id,
            'requested_by_user_id' => null,
        ]);
        IntegrationDeliveryPayload::factory()->create(['integration_delivery_id' => $delivery->id, 'message' => ['id' => $delivery->id, 'event' => 'action_item.completed', 'occurredAt' => '2026-10-07T10:00:00Z', 'data' => []]]);

        return $delivery;
    });

    $deliveries->take(10)->each(fn (IntegrationDelivery $delivery) => $this->actingAs($admin)->postJson($url($delivery))->assertAccepted());

    $this->actingAs($admin)->postJson($url($deliveries->last()))->assertTooManyRequests();
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Integrations/WebhookRedeliveryTest.php`
Expected: FAIL — `Route [teams.integrations.deliveries.show] not defined.`

- [ ] **Step 3: Write the lookup and the payload presenter**

Replace `app/Actions/Integrations/FindWebhookDelivery.php` with:

```php
<?php

namespace App\Actions\Integrations;

use App\Enums\IntegrationDeliveryChannel;
use App\Models\IntegrationDelivery;
use App\Models\Team;

class FindWebhookDelivery
{
    /**
     * A delivery of the team's generic webhook log, across reconnections
     * (spec 8 §4.7); anything else is a 404.
     */
    public function handle(Team $team, string $deliveryId): IntegrationDelivery
    {
        return IntegrationDelivery::query()
            ->with('payload')
            ->where('team_id', $team->id)
            ->where('channel', IntegrationDeliveryChannel::Webhook->value)
            ->whereKey($deliveryId)
            ->firstOrFail();
    }
}
```

Replace `app/Actions/Integrations/PresentWebhookDeliveryPayload.php` with:

```php
<?php

namespace App\Actions\Integrations;

use App\Models\IntegrationDelivery;
use InvalidArgumentException;

class PresentWebhookDeliveryPayload
{
    /**
     * @return array{
     *     id: string,
     *     event: string|null,
     *     status: string,
     *     attempts: int,
     *     redeliveryOf: string|null,
     *     request: array{headers: array<string, string>, body: string|null},
     *     response: array{status: int|null, excerpt: string|null}
     * }
     */
    public function handle(IntegrationDelivery $delivery): array
    {
        $payload = $delivery->payload ?? throw new InvalidArgumentException('The delivery has no stored content.');
        $excerpt = $payload->response_excerpt;

        return [
            'id' => $delivery->id,
            'event' => $delivery->event,
            'status' => $delivery->status->value,
            'attempts' => $delivery->attempts,
            'redeliveryOf' => $delivery->redelivery_of_id,
            'request' => [
                'headers' => $payload->request_headers ?? [],
                'body' => $payload->request_body,
            ],
            'response' => [
                'status' => $payload->response_status,
                'excerpt' => $excerpt === null ? null : mb_scrub($excerpt, 'UTF-8'),
            ],
        ];
    }
}
```

- [ ] **Step 4: Present content and redelivery on list rows**

Replace `app/Actions/Integrations/PresentWebhookDelivery.php` with:

```php
<?php

namespace App\Actions\Integrations;

use App\Models\IntegrationDelivery;

class PresentWebhookDelivery
{
    /**
     * @return array{
     *     id: string,
     *     event: string|null,
     *     kind: string,
     *     status: string,
     *     attempts: int,
     *     responseStatus: int|null,
     *     error: string|null,
     *     createdAt: string|null,
     *     lastAttemptAt: string|null,
     *     hasContent: bool,
     *     redeliveryOf: string|null
     * }
     */
    public function handle(IntegrationDelivery $delivery): array
    {
        return [
            'id' => $delivery->id,
            'event' => $delivery->event,
            'kind' => $delivery->kind->value,
            'status' => $delivery->status->value,
            'attempts' => $delivery->attempts,
            'responseStatus' => $delivery->response_status,
            'error' => $delivery->error,
            'createdAt' => $delivery->created_at?->toIso8601String(),
            'lastAttemptAt' => $delivery->last_attempt_at?->toIso8601String(),
            'hasContent' => $this->hasContent($delivery),
            'redeliveryOf' => $delivery->redelivery_of_id,
        ];
    }

    private function hasContent(IntegrationDelivery $delivery): bool
    {
        $exists = $delivery->getAttribute('payload_exists');

        if ($exists === null) {
            return $delivery->payload()->exists();
        }

        return (bool) $exists;
    }
}
```

- [ ] **Step 5: Add `show` and the redeliveries controller**

In `app/Http/Controllers/Integrations/WebhookDeliveriesController.php`:

1. Add the imports `use App\Actions\Integrations\FindWebhookDelivery;` and `use App\Actions\Integrations\PresentWebhookDeliveryPayload;`.
2. In `index()`, add `->withExists('payload')` right after `IntegrationDelivery::query()`.
3. After `index()`, add:

```php
    public function show(
        Workspace $workspace,
        Team $team,
        TeamIntegration $integration,
        string $delivery,
        FindWebhookDelivery $findWebhookDelivery,
        PresentWebhookDeliveryPayload $presentWebhookDeliveryPayload,
    ): JsonResponse {
        Gate::authorize('manageIntegrations', $team);

        abort_unless($integration->provider === IntegrationProvider::Webhook, 404);

        $found = $findWebhookDelivery->handle($team, $delivery);

        abort_if($found->payload === null, 404);

        return response()->json($presentWebhookDeliveryPayload->handle($found));
    }
```

Run `vendor/bin/sail artisan make:controller Integrations/WebhookRedeliveriesController --no-interaction` and replace the file with:

```php
<?php

namespace App\Http\Controllers\Integrations;

use App\Actions\Integrations\FindWebhookDelivery;
use App\Actions\Integrations\PresentWebhookDelivery;
use App\Actions\Integrations\RequestWebhookRedelivery;
use App\Enums\IntegrationProvider;
use App\Http\Controllers\Controller;
use App\Models\Team;
use App\Models\TeamIntegration;
use App\Models\Workspace;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

/**
 * Sends a past generic webhook delivery again (webhook redelivery spec §4.2).
 */
class WebhookRedeliveriesController extends Controller
{
    public function store(
        Request $request,
        Workspace $workspace,
        Team $team,
        TeamIntegration $integration,
        string $delivery,
        FindWebhookDelivery $findWebhookDelivery,
        RequestWebhookRedelivery $requestWebhookRedelivery,
        PresentWebhookDelivery $presentWebhookDelivery,
    ): JsonResponse {
        Gate::authorize('manageIntegrations', $team);

        abort_unless($integration->provider === IntegrationProvider::Webhook, 404);

        $redelivery = $requestWebhookRedelivery->handle($integration, $findWebhookDelivery->handle($team, $delivery), $request->user());

        return response()->json($presentWebhookDelivery->handle($redelivery), 202);
    }
}
```

- [ ] **Step 6: Add the routes**

In `routes/web.php`, add `use App\Http\Controllers\Integrations\WebhookRedeliveriesController;` with the other integration controller imports, and right after the `teams.integrations.deliveries.index` route (inside the same `EnsureIntegrationProviderEnabled` group) add:

```php
                Route::get('teams/{team}/integrations/{integration}/deliveries/{delivery}', [WebhookDeliveriesController::class, 'show'])
                    ->whereUuid(['integration', 'delivery'])
                    ->middleware('throttle:60,1,webhookDeliveries')
                    ->name('teams.integrations.deliveries.show');
                Route::post('teams/{team}/integrations/{integration}/deliveries/{delivery}/redelivery', [WebhookRedeliveriesController::class, 'store'])
                    ->whereUuid(['integration', 'delivery'])
                    ->middleware('throttle:10,1,webhookRedeliveries')
                    ->name('teams.integrations.deliveries.redelivery.store');
```

Then run `vendor/bin/sail artisan wayfinder:generate --with-form` (do not stage its output).

- [ ] **Step 7: Run tests to verify they pass**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Integrations/WebhookRedeliveryTest.php tests/Feature/Integrations/ConnectOutgoingWebhookTest.php tests/Feature/Integrations/WebhookPayloadsTest.php`
Expected: PASS.

- [ ] **Step 8: Format, analyse, commit**

```bash
vendor/bin/sail bin pint --dirty --format agent
vendor/bin/sail bin phpstan analyse --no-progress
git add app/Actions/Integrations/FindWebhookDelivery.php app/Actions/Integrations/PresentWebhookDeliveryPayload.php app/Actions/Integrations/PresentWebhookDelivery.php app/Http/Controllers/Integrations/WebhookDeliveriesController.php app/Http/Controllers/Integrations/WebhookRedeliveriesController.php routes/web.php tests/Feature/Integrations/WebhookRedeliveryTest.php
git commit -m "feat(integrations): view and redeliver webhook deliveries from the log"
```

---

### Task 6: View dialog and Redeliver in the deliveries panel

**Files:**
- Create: `resources/js/components/integrations/webhook-delivery-dialog.tsx`
- Modify: `resources/js/types/integrations.ts:140-157`, `resources/js/components/integrations/webhook-deliveries-panel.tsx`, `lang/{en,fr,es,de}.json`

**Interfaces:**
- Consumes: Task 5 (Wayfinder `WebhookDeliveriesController.show`, `WebhookRedeliveriesController.store`; row fields `hasContent`, `redeliveryOf`; view shape).
- Produces: `WebhookDelivery.hasContent`, `WebhookDelivery.redeliveryOf`, type `WebhookDeliveryDetails`, component `WebhookDeliveryDialog({ details, failed, onClose })`.

No frontend test runner exists (spec 8 §13); the behaviour behind these screens is covered by Tasks 1–5. Verify with type-check, lint, build, the translation test and the walkthrough of Task 7.

- [ ] **Step 1: Extend the types**

In `resources/js/types/integrations.ts`, replace `WebhookDelivery` with:

```ts
export type WebhookDelivery = {
    id: string;
    event: string | null;
    kind: string;
    status: DeliveryStatus;
    attempts: number;
    responseStatus: number | null;
    error: string | null;
    createdAt: string | null;
    lastAttemptAt: string | null;
    hasContent: boolean;
    redeliveryOf: string | null;
};

export type WebhookDeliveryDetails = {
    id: string;
    event: string | null;
    status: DeliveryStatus;
    attempts: number;
    redeliveryOf: string | null;
    request: { headers: Record<string, string>; body: string | null };
    response: { status: number | null; excerpt: string | null };
};
```

- [ ] **Step 2: Write the View dialog**

Create `resources/js/components/integrations/webhook-delivery-dialog.tsx`:

```tsx
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Spinner } from '@/components/ui/spinner';
import { useClipboard } from '@/hooks/use-clipboard';
import { useTrans } from '@/hooks/use-trans';
import type { WebhookDeliveryDetails } from '@/types';

type Props = {
    details: WebhookDeliveryDetails | null;
    failed: boolean;
    onClose: () => void;
};

type Tab = 'request' | 'response';

function prettyBody(body: string): string {
    try {
        return JSON.stringify(JSON.parse(body), null, 2);
    } catch {
        return body;
    }
}

export function WebhookDeliveryDialog({ details, failed, onClose }: Props) {
    const { t } = useTrans();
    const [, copy] = useClipboard();
    const [tab, setTab] = useState<Tab>('request');

    const copyBody = async (body: string) => {
        if (await copy(body)) {
            toast(t('Body copied.'));

            return;
        }

        toast.error(t('Something went wrong. Please try again.'));
    };

    const headers = details === null ? [] : Object.entries(details.request.headers);

    return (
        <Dialog
            open
            onOpenChange={(open) => {
                if (!open) {
                    onClose();
                }
            }}
        >
            <DialogContent className="sm:max-w-2xl">
                <DialogHeader>
                    <DialogTitle>{t('Delivery details')}</DialogTitle>
                    <DialogDescription>{details?.event ?? ''}</DialogDescription>
                </DialogHeader>
                {details === null && !failed && <Spinner />}
                {failed && (
                    <p className="text-sm text-destructive">
                        {t('Could not load this delivery.')}
                    </p>
                )}
                {details !== null && (
                    <div className="space-y-3">
                        <div className="flex gap-2" role="group" aria-label={t('Delivery details')}>
                            <Button
                                size="sm"
                                variant={tab === 'request' ? 'default' : 'outline'}
                                aria-pressed={tab === 'request'}
                                onClick={() => setTab('request')}
                            >
                                {t('Request')}
                            </Button>
                            <Button
                                size="sm"
                                variant={tab === 'response' ? 'default' : 'outline'}
                                aria-pressed={tab === 'response'}
                                onClick={() => setTab('response')}
                            >
                                {t('Response')}
                            </Button>
                        </div>
                        {tab === 'request' && headers.length === 0 && (
                            <p className="text-sm text-muted-foreground">
                                {t('Not sent yet.')}
                            </p>
                        )}
                        {tab === 'request' && headers.length > 0 && (
                            <div className="space-y-3">
                                <table className="w-full text-left text-xs" aria-label={t('Headers')}>
                                    <tbody>
                                        {headers.map(([name, value]) => (
                                            <tr key={name} className="border-t">
                                                <th scope="row" className="py-1 pr-3 font-medium whitespace-nowrap">
                                                    {name}
                                                </th>
                                                <td className="py-1 break-all">
                                                    <code>{value}</code>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                {details.request.body !== null && (
                                    <div className="space-y-1">
                                        <div className="flex items-center justify-between gap-2">
                                            <h4 className="text-xs font-medium">{t('Body')}</h4>
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() => void copyBody(details.request.body ?? '')}
                                            >
                                                {t('Copy')}
                                            </Button>
                                        </div>
                                        <pre className="max-h-80 overflow-auto rounded bg-muted p-2 text-xs">
                                            {prettyBody(details.request.body)}
                                        </pre>
                                    </div>
                                )}
                            </div>
                        )}
                        {tab === 'response' && (
                            <div className="space-y-1 text-sm">
                                <p>
                                    {t('Status: :status', {
                                        status: details.response.status ?? '—',
                                    })}
                                </p>
                                {details.response.excerpt === null ? (
                                    <p className="text-muted-foreground">{t('No response body.')}</p>
                                ) : (
                                    <pre className="max-h-80 overflow-auto rounded bg-muted p-2 text-xs whitespace-pre-wrap">
                                        {details.response.excerpt}
                                    </pre>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}
```

- [ ] **Step 3: Add View and Redeliver to the panel**

In `resources/js/components/integrations/webhook-deliveries-panel.tsx`:

1. Replace the imports with:

```tsx
import { usePage } from '@inertiajs/react';
import { useRef, useState } from 'react';
import { toast } from 'sonner';
import WebhookDeliveriesController from '@/actions/App/Http/Controllers/Integrations/WebhookDeliveriesController';
import WebhookRedeliveriesController from '@/actions/App/Http/Controllers/Integrations/WebhookRedeliveriesController';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Spinner } from '@/components/ui/spinner';
import { useTrans } from '@/hooks/use-trans';
import { integrationErrorMessage } from '@/lib/integrations';
import { retroRequest } from '@/lib/retro/api';
import type {
    DeliveryStatus,
    IntegrationScope,
    TeamIntegration,
    WebhookDelivery,
    WebhookDeliveryDetails,
    WebhookDeliveryPage,
} from '@/types';
import { WebhookDeliveryDialog } from './webhook-delivery-dialog';

const PayloadRetentionDays = 30;
const DayMilliseconds = 86_400_000;
```

2. After the existing `const latestRequest = useRef(0);`, add:

```tsx
    const [viewing, setViewing] = useState<WebhookDelivery | null>(null);
    const [details, setDetails] = useState<WebhookDeliveryDetails | null>(null);
    const [detailsFailed, setDetailsFailed] = useState(false);
    const latestDetails = useRef(0);
    const [redelivering, setRedelivering] = useState<WebhookDelivery | null>(null);
    const [redeliverError, setRedeliverError] = useState<string | null>(null);
    const [sending, setSending] = useState(false);
```

3. After `toggle`, add:

```tsx
    const openDetails = async (delivery: WebhookDelivery) => {
        const requestId = ++latestDetails.current;
        setViewing(delivery);
        setDetails(null);
        setDetailsFailed(false);

        try {
            const loaded = await retroRequest<WebhookDeliveryDetails>(
                WebhookDeliveriesController.show({
                    ...scope,
                    integration: connection.id,
                    delivery: delivery.id,
                }),
            );

            if (requestId === latestDetails.current) {
                setDetails(loaded);
            }
        } catch (error) {
            if (requestId === latestDetails.current) {
                setDetailsFailed(true);
                toast.error(
                    integrationErrorMessage(error, t('Could not load this delivery.')),
                );
            }
        }
    };

    const closeDetails = () => {
        latestDetails.current++;
        setViewing(null);
    };

    const askRedelivery = (delivery: WebhookDelivery) => {
        setRedeliverError(null);
        setRedelivering(delivery);
    };

    const redeliver = async () => {
        if (redelivering === null) {
            return;
        }

        setSending(true);
        setRedeliverError(null);

        try {
            await retroRequest<WebhookDelivery>(
                WebhookRedeliveriesController.store({
                    ...scope,
                    integration: connection.id,
                    delivery: redelivering.id,
                }),
            );
            toast(t('Delivery queued again.'));
            setRedelivering(null);
            void load(1);
        } catch (error) {
            setRedeliverError(
                integrationErrorMessage(error, t('Something went wrong.')),
            );
        } finally {
            setSending(false);
        }
    };

    const canRedeliver = (delivery: WebhookDelivery): boolean =>
        delivery.hasContent &&
        delivery.status !== 'queued' &&
        connection.status === 'active';

    const contentNote = (delivery: WebhookDelivery): string => {
        const createdAt =
            delivery.createdAt === null ? null : new Date(delivery.createdAt).getTime();
        const expired =
            createdAt !== null &&
            Date.now() - createdAt > PayloadRetentionDays * DayMilliseconds;

        return expired ? t('Content no longer kept') : t('Content not kept');
    };
```

4. In the table header, after the `Error` `<th>`, change that `<th className="py-1 font-medium">` to `<th className="py-1 pr-3 font-medium">` and add:

```tsx
                                    <th className="py-1 font-medium">
                                        <span className="sr-only">{t('Actions')}</span>
                                    </th>
```

5. In each row, replace the Event cell with:

```tsx
                                        <td className="py-1 pr-3">
                                            <code>{kindLabel(delivery)}</code>
                                            {delivery.redeliveryOf !== null && (
                                                <span className="ml-2 text-muted-foreground">
                                                    {t('Redelivery')}
                                                </span>
                                            )}
                                        </td>
```

change the Error cell's class to `"py-1 pr-3 break-words"`, and add after it:

```tsx
                                        <td className="py-1 whitespace-nowrap">
                                            {delivery.hasContent ? (
                                                <div className="flex gap-1">
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => void openDetails(delivery)}
                                                    >
                                                        {t('View')}
                                                    </Button>
                                                    {canRedeliver(delivery) && (
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={() => askRedelivery(delivery)}
                                                        >
                                                            {t('Redeliver')}
                                                        </Button>
                                                    )}
                                                </div>
                                            ) : (
                                                <span className="text-muted-foreground">
                                                    {contentNote(delivery)}
                                                </span>
                                            )}
                                        </td>
```

6. Just before the closing `</section>`, add:

```tsx
            {viewing !== null && (
                <WebhookDeliveryDialog
                    details={details}
                    failed={detailsFailed}
                    onClose={closeDetails}
                />
            )}
            {redelivering !== null && (
                <Dialog
                    open
                    onOpenChange={(open) => {
                        if (!open && !sending) {
                            setRedelivering(null);
                        }
                    }}
                >
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>{t('Redeliver')}</DialogTitle>
                            <DialogDescription>
                                {t('Send this delivery again to :host?', {
                                    host: connection.settings.host ?? '',
                                })}
                            </DialogDescription>
                        </DialogHeader>
                        {redeliverError !== null && (
                            <p className="text-sm text-destructive" role="alert">
                                {redeliverError}
                            </p>
                        )}
                        <DialogFooter>
                            <Button
                                variant="outline"
                                disabled={sending}
                                onClick={() => setRedelivering(null)}
                            >
                                {t('Cancel')}
                            </Button>
                            <Button disabled={sending} onClick={() => void redeliver()}>
                                {sending && <Spinner />}
                                {t('Redeliver')}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            )}
```

- [ ] **Step 4: Add the interface strings**

Append to `lang/en.json` (comma after the previous last line):

```json
    "View": "View",
    "Redeliver": "Redeliver",
    "Redelivery": "Redelivery",
    "Request": "Request",
    "Headers": "Headers",
    "Body": "Body",
    "Body copied.": "Body copied.",
    "No response body.": "No response body.",
    "Not sent yet.": "Not sent yet.",
    "Content no longer kept": "Content no longer kept",
    "Content not kept": "Content not kept",
    "Send this delivery again to :host?": "Send this delivery again to :host?",
    "Delivery queued again.": "Delivery queued again.",
    "Delivery details": "Delivery details",
    "Could not load this delivery.": "Could not load this delivery.",
    "Status: :status": "Status: :status"
```

`lang/fr.json`:

```json
    "View": "Voir",
    "Redeliver": "Renvoyer",
    "Redelivery": "Renvoi",
    "Request": "Requête",
    "Headers": "En-têtes",
    "Body": "Corps",
    "Body copied.": "Corps copié.",
    "No response body.": "Aucun corps de réponse.",
    "Not sent yet.": "Pas encore envoyé.",
    "Content no longer kept": "Contenu plus conservé",
    "Content not kept": "Contenu non conservé",
    "Send this delivery again to :host?": "Renvoyer cet envoi à :host ?",
    "Delivery queued again.": "Envoi remis en file d'attente.",
    "Delivery details": "Détails de l'envoi",
    "Could not load this delivery.": "Impossible de charger cet envoi.",
    "Status: :status": "Statut : :status"
```

`lang/es.json`:

```json
    "View": "Ver",
    "Redeliver": "Reenviar",
    "Redelivery": "Reenvío",
    "Request": "Solicitud",
    "Headers": "Encabezados",
    "Body": "Cuerpo",
    "Body copied.": "Cuerpo copiado.",
    "No response body.": "Sin cuerpo de respuesta.",
    "Not sent yet.": "Aún no enviado.",
    "Content no longer kept": "Contenido ya no conservado",
    "Content not kept": "Contenido no conservado",
    "Send this delivery again to :host?": "¿Reenviar este envío a :host?",
    "Delivery queued again.": "Envío puesto de nuevo en cola.",
    "Delivery details": "Detalles del envío",
    "Could not load this delivery.": "No se pudo cargar este envío.",
    "Status: :status": "Estado: :status"
```

`lang/de.json`:

```json
    "View": "Ansehen",
    "Redeliver": "Erneut senden",
    "Redelivery": "Erneute Zustellung",
    "Request": "Anfrage",
    "Headers": "Header",
    "Body": "Inhalt",
    "Body copied.": "Inhalt kopiert.",
    "No response body.": "Kein Antwortinhalt.",
    "Not sent yet.": "Noch nicht gesendet.",
    "Content no longer kept": "Inhalt nicht mehr aufbewahrt",
    "Content not kept": "Inhalt nicht aufbewahrt",
    "Send this delivery again to :host?": "Diese Zustellung erneut an :host senden?",
    "Delivery queued again.": "Zustellung erneut eingereiht.",
    "Delivery details": "Zustellungsdetails",
    "Could not load this delivery.": "Diese Zustellung konnte nicht geladen werden.",
    "Status: :status": "Status: :status"
```

Before adding each key, check it is not already in the file (`grep -n '^    "View":' lang/en.json` etc.); a key that already exists keeps its current value and is not added twice.

- [ ] **Step 5: Verify**

```bash
npm run build
vendor/bin/sail artisan wayfinder:generate --with-form
npm run types:check
npm run check
vendor/bin/sail artisan test --compact tests/Feature/TranslationKeysTest.php tests/Feature/Integrations/IntegrationsPageTest.php
```

Expected: build succeeds, no type errors, lint clean except `.devcontainer/devcontainer.json` and `docs/superpowers/*.md`, tests pass.

- [ ] **Step 6: Commit**

```bash
git add resources/js/components/integrations/webhook-delivery-dialog.tsx resources/js/components/integrations/webhook-deliveries-panel.tsx resources/js/types/integrations.ts lang/en.json lang/fr.json lang/es.json lang/de.json
git commit -m "feat(integrations): view and redeliver webhook deliveries from the integrations page"
```

---

### Task 7: Verification and spec alignment

**Files:**
- Modify: `docs/superpowers/specs/2026-10-01-webhook-redelivery-design.md`

- [ ] **Step 1: Run every check**

```bash
vendor/bin/sail artisan test --compact --parallel --processes=4
vendor/bin/sail bin pint --dirty --format agent
vendor/bin/sail bin phpstan analyse --no-progress
npm run build
vendor/bin/sail artisan wayfinder:generate --with-form
npm run types:check
npm run check
```

Expected: suite green (rerun any Postgres `max_locks_per_transaction` failure without `--parallel` — infrastructure, not code), pint clean, phpstan 0 errors, build succeeds, no type errors, lint clean except `.devcontainer/devcontainer.json` and `docs/superpowers/*.md`.

- [ ] **Step 2: Check the secret rules by search**

```bash
grep -rn "request_body\|response_excerpt\|request_headers" app | grep -v "IntegrationDeliveryPayload.php\|WebhookClient.php\|PresentWebhookDeliveryPayload.php"
grep -rn "Log::\|logger(" app/Support/Integrations/Webhook app/Jobs/Integrations/RedeliverWebhook.php app/Jobs/Integrations/SendsToWebhook.php app/Actions/Integrations/RequestWebhookRedelivery.php
```

Expected: both print nothing.

- [ ] **Step 3: Align the spec with the rulings**

In `docs/superpowers/specs/2026-10-01-webhook-redelivery-design.md`:
- §3 "Size limit": replace with "When the message, counted twice (the body repeats it) plus 4 KB of envelope, exceeds 512 KB, no payload row is written when the delivery is queued and the delivery shows "Content not kept"." (R2)
- §4.2 step 2: replace "same … `team_integration_id` …" by "`team_integration_id` = the current webhook connection" (R6).
- §4.3 first bullet: "it belongs to this team's webhook log (`team_id` and channel `webhook`, across reconnections) (else **404**);" (R3)
- §5 last bullet: "Payload contents, headers and response excerpts never appear in logs or exception messages. Share and event jobs are encrypted on the queue (`ShouldBeEncrypted`), so `failed_jobs` never holds their message in clear; the redelivery job carries the delivery id only." (R1)
- §8: add "the response excerpt is collected from curl's write callback; with faked HTTP the response body stands in for it" (R4) and "a redelivery whose content disappeared fails with "This delivery's content is no longer kept." without counting toward the automatic disabling" (R5).

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/specs/2026-10-01-webhook-redelivery-design.md
git commit -m "docs: align the webhook redelivery spec with plan 15"
```

- [ ] **Step 5: Walkthrough (for the user; not automatable here)**

Point a webhook at a request inspector (e.g. a local `nc -l` or a hosted request bin reachable over HTTPS), subscribe it to `action_item.completed`, complete an action item, open **Deliveries → View** and check the headers (signature masked), body and response; stop the receiver, complete another item, see the delivery fail after its retries, restart the receiver, click **Redeliver**, confirm, and see the same `X-Skrum-Delivery` id arrive with `X-Skrum-Redelivery: true` and a new row marked "Redelivery" in the log. Disable the webhook (or wait for 10 failures) and check that Redeliver is no longer offered.

---

## Self-review

- **Spec coverage:** §1 viewer + Redeliver (Tasks 5–6); §2 scope — webhook only, test messages never stored (Task 3 test), pre-feature deliveries show "Content not kept" (Task 6 `contentNote`); §3 table, encryption, never-stored fields, size limit, 30-day retention (Tasks 1–3); §4.1 storing on queue (Task 2) and per attempt with masked signature and 2 KB excerpt (Task 3); §4.2 redelivery steps and send rules (Task 4); §4.3 eligibility and messages (Task 4, HTTP in Task 5); §4.4 view shape, list `hasContent`/`redeliveryOf` (Task 5); §5 permissions, provider gate, throttles, no secrets in logs (Tasks 5 and 7); §6 interface (Task 6); §7 errors table (Tasks 4–5); §8 tests (Tasks 1–5) and walkthrough (Task 7).
- **Placeholder scan:** every new file has full code; edits of existing files give their anchor and replacement.
- **Type consistency:** `IntegrationDeliveryPayload::message` shape `{id, event, occurredAt, data}` is the same in `StoreWebhookPayload`, `RequestWebhookRedelivery`, `RedeliverWebhook` and the tests; `WebhookMessage(..., bool $redelivery = false)` is used by `RedeliverWebhook` and Task 3's test; `WebhookClient::pendingRequest(WebhookTarget, ?ResponseExcerpt)` keeps its first parameter so existing callers and tests are unchanged; route names `teams.integrations.deliveries.show` / `.redelivery.store` match Wayfinder `WebhookDeliveriesController.show` / `WebhookRedeliveriesController.store`; the TS fields `hasContent`/`redeliveryOf` match `PresentWebhookDelivery`.
- **Review Focus:** each of the five lines has its test in Task 4 or Task 5.
