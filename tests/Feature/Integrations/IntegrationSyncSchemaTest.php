<?php

use App\Enums\ExternalIssueState;
use App\Enums\ExternalStatusCategory;
use App\Enums\InboundEventStatus;
use App\Enums\IntegrationDeliveryChannel;
use App\Enums\IntegrationDeliveryKind;
use App\Enums\IntegrationInboundMode;
use App\Enums\IntegrationProvider;
use App\Enums\IntegrationUserMatch;
use App\Enums\IntegrationWebhookStatus;
use App\Models\ActionItemExternalLink;
use App\Models\IntegrationDelivery;
use App\Models\IntegrationInboundEvent;
use App\Models\PokerTask;
use App\Models\TeamIntegration;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Schema;

beforeEach(fn () => Http::preventStrayRequests());

it('gives team integrations sync defaults and casts', function () {
    $integration = TeamIntegration::factory()->linear()->create();

    expect($integration->inbound_mode)->toBe(IntegrationInboundMode::Off)
        ->and($integration->consecutive_failures)->toBe(0)
        ->and($integration->webhook_status)->toBeNull()
        ->and($integration->fresh()->inbound_mode)->toBe(IntegrationInboundMode::Off);

    $integration->forceFill([
        'inbound_mode' => IntegrationInboundMode::Polling,
        'webhook_status' => IntegrationWebhookStatus::Failing,
        'webhook_expires_at' => now()->addDays(30),
        'last_inbound_at' => now(),
        'last_polled_at' => now(),
        'poll_cursor' => now()->subMinutes(5),
        'consecutive_failures' => 3,
        'last_delivery_succeeded_at' => now(),
    ])->save();

    $fresh = $integration->fresh();

    expect($fresh->inbound_mode)->toBe(IntegrationInboundMode::Polling)
        ->and($fresh->webhook_status)->toBe(IntegrationWebhookStatus::Failing)
        ->and($fresh->webhook_expires_at?->isFuture())->toBeTrue()
        ->and($fresh->poll_cursor)->not->toBeNull()
        ->and($fresh->consecutive_failures)->toBe(3)
        ->and($fresh->last_delivery_succeeded_at)->not->toBeNull();
});

it('stores the sync state of external links for every tracker', function () {
    $link = ActionItemExternalLink::factory()->create(['source' => IntegrationProvider::GitHub, 'external_site' => '4242']);

    $link->forceFill([
        'external_state' => ExternalIssueState::Done,
        'external_status_name' => 'closed',
        'external_updated_at' => now(),
        'local_state_changed_at' => now(),
        'last_pushed_state' => ExternalIssueState::Open,
        'last_pushed_at' => now(),
        'last_synced_at' => now(),
        'sync_error' => 'Nope',
        'missing_at' => now(),
    ])->save();

    $fresh = $link->fresh();

    expect($fresh->source)->toBe(IntegrationProvider::GitHub)
        ->and($fresh->external_state)->toBe(ExternalIssueState::Done)
        ->and($fresh->last_pushed_state)->toBe(ExternalIssueState::Open)
        ->and($fresh->external_status_name)->toBe('closed')
        ->and($fresh->missing_at)->not->toBeNull()
        ->and(Schema::hasIndex('action_item_external_links', ['source', 'external_site', 'external_id']))->toBeTrue();
});

it('stores the source status of poker tasks', function () {
    $task = PokerTask::factory()->imported(IntegrationProvider::Jira)->create();

    $task->forceFill([
        'external_source' => IntegrationProvider::JiraDataCenter->value,
        'external_status_name' => 'In review',
        'external_status_category' => ExternalStatusCategory::InProgress,
        'external_updated_at' => now(),
        'external_missing_at' => now(),
    ])->save();

    $fresh = $task->fresh();

    expect($fresh->external_source)->toBe('jira_dc')
        ->and($fresh->external_status_category)->toBe(ExternalStatusCategory::InProgress)
        ->and($fresh->external_status_name)->toBe('In review')
        ->and($fresh->external_missing_at)->not->toBeNull()
        ->and(Schema::hasIndex('poker_tasks', ['external_source', 'external_site', 'external_id']))->toBeTrue();
});

it('logs event deliveries against their integration', function () {
    $integration = TeamIntegration::factory()->slack()->create();
    $delivery = IntegrationDelivery::factory()->create([
        'team_id' => $integration->team_id,
        'channel' => IntegrationDeliveryChannel::Webhook,
        'kind' => IntegrationDeliveryKind::Event,
        'team_integration_id' => $integration->id,
        'event' => 'action_item.completed',
        'attempts' => 2,
        'response_status' => 503,
        'last_attempt_at' => now(),
        'requested_by_user_id' => null,
    ]);

    expect($delivery->fresh()->integration->is($integration))->toBeTrue()
        ->and($delivery->fresh()->attempts)->toBe(2)
        ->and($delivery->fresh()->response_status)->toBe(503)
        ->and($delivery->fresh()->channel->provider())->toBe(IntegrationProvider::Webhook);

    $integration->delete();

    expect($delivery->fresh()->team_integration_id)->toBeNull();
});

it('maps the new delivery channels to their providers', function () {
    expect(IntegrationDeliveryChannel::MicrosoftTeams->provider())->toBe(IntegrationProvider::MicrosoftTeams)
        ->and(IntegrationDeliveryChannel::Mattermost->provider())->toBe(IntegrationProvider::Mattermost)
        ->and(IntegrationDeliveryChannel::Webhook->provider())->toBe(IntegrationProvider::Webhook)
        ->and(IntegrationUserMatch::from('sso'))->toBe(IntegrationUserMatch::Sso);
});

it('de-duplicates inbound events per provider and prunes them after 7 days', function () {
    $integration = TeamIntegration::factory()->jira()->create();
    $kept = IntegrationInboundEvent::factory()->create(['team_integration_id' => $integration->id, 'event_key' => 'delivery-1']);
    IntegrationInboundEvent::factory()->create(['provider' => IntegrationProvider::Linear, 'event_key' => 'delivery-1']);
    $old = IntegrationInboundEvent::factory()->create(['received_at' => now()->subDays(8)]);

    expect(fn () => DB::transaction(fn () => IntegrationInboundEvent::factory()->create(['event_key' => 'delivery-1'])))
        ->toThrow(UniqueConstraintViolationException::class);

    expect($kept->fresh()->status)->toBe(InboundEventStatus::Applied)
        ->and($kept->fresh()->provider)->toBe(IntegrationProvider::Jira)
        ->and($kept->fresh()->integration->is($integration))->toBeTrue();

    $this->artisan('model:prune', ['--model' => [IntegrationInboundEvent::class]])->assertSuccessful();

    expect(IntegrationInboundEvent::query()->find($old->id))->toBeNull()
        ->and(IntegrationInboundEvent::query()->count())->toBe(2);

    $integration->delete();

    expect($kept->fresh()->team_integration_id)->toBeNull();
});
