<?php

use App\Enums\IntegrationAccess;
use App\Enums\IntegrationDeliveryStatus;
use App\Enums\IntegrationProvider;
use App\Enums\IntegrationStatus;
use App\Enums\IntegrationUserMatch;
use App\Exceptions\Integrations\NotConnected;
use App\Exceptions\Integrations\ReadOnlyConnection;
use App\Exceptions\Integrations\ReconnectRequired;
use App\Models\ActionItem;
use App\Models\ActionItemExternalLink;
use App\Models\IntegrationDelivery;
use App\Models\IntegrationUserMapping;
use App\Models\PokerGame;
use App\Models\PokerTask;
use App\Models\Retro;
use App\Models\TeamIntegration;
use App\Models\User;
use App\Support\Integrations\IntegrationAvailability;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Encryption\Encrypter;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;

beforeEach(fn () => Http::preventStrayRequests());

it('encrypts credentials at rest and never serializes them', function () {
    $integration = TeamIntegration::factory()->slack()->create();

    $stored = (string) DB::table('team_integrations')->where('id', $integration->id)->value('credentials');

    expect($stored)->not->toContain('xoxp-test-token')
        ->and($stored)->not->toContain('hooks.slack.com')
        ->and($integration->fresh()->credential('access_token'))->toBe('xoxp-test-token')
        ->and($integration->toArray())->not->toHaveKey('credentials')
        ->and($integration->toJson())->not->toContain('xoxp');
});

it('keeps one connection per provider and team', function () {
    $slack = TeamIntegration::factory()->slack()->create();

    expect(fn () => DB::transaction(fn () => TeamIntegration::factory()->slack()->create(['team_id' => $slack->team_id])))
        ->toThrow(UniqueConstraintViolationException::class);

    $telegram = TeamIntegration::factory()->telegram()->create(['team_id' => $slack->team_id]);

    expect($slack->team->integration(IntegrationProvider::Slack)?->id)->toBe($slack->id)
        ->and($slack->team->integration(IntegrationProvider::Telegram)?->id)->toBe($telegram->id)
        ->and($slack->team->integration(IntegrationProvider::Jira))->toBeNull();
});

it('marks the integration reconnect-required when credentials cannot be decrypted', function () {
    $integration = TeamIntegration::factory()->slack()->create();
    $otherKey = new Encrypter(Encrypter::generateKey((string) config('app.cipher')), (string) config('app.cipher'));

    DB::table('team_integrations')->where('id', $integration->id)->update([
        'credentials' => $otherKey->encrypt(json_encode(['access_token' => 'xoxp-old']), false),
    ]);

    $unreadable = $integration->fresh();

    expect($unreadable->readableCredentials())->toBeNull()
        ->and($unreadable->fresh()->status)->toBe(IntegrationStatus::ReconnectRequired)
        ->and($unreadable->fresh()->last_error)->toBe('Stored credentials could not be read. Reconnect.')
        ->and(fn () => $unreadable->fresh()->credential('access_token'))->toThrow(ReconnectRequired::class);
});

it('marks the integration when a provider call loses access', function () {
    $integration = TeamIntegration::factory()->slack()->create();

    expect(fn () => $integration->withReconnectHandling(fn () => throw new ReconnectRequired(IntegrationProvider::Slack, 'token_revoked')))
        ->toThrow(ReconnectRequired::class)
        ->and($integration->fresh()->status)->toBe(IntegrationStatus::ReconnectRequired)
        ->and($integration->fresh()->last_error)->toBe('token_revoked');
});

it('tells active, writable and readable connections apart', function () {
    $write = TeamIntegration::factory()->jira()->create();
    $read = TeamIntegration::factory()->jira(IntegrationAccess::Read)->create();
    $broken = TeamIntegration::factory()->jira()->reconnectRequired()->create();
    $setup = TeamIntegration::factory()->setupRequired()->create();

    expect($write->canWrite())->toBeTrue()
        ->and($write->site())->toBe('cloud-1')
        ->and($write->hasScope('read:jira-user'))->toBeTrue()
        ->and($read->isActive())->toBeTrue()
        ->and($read->canWrite())->toBeFalse()
        ->and($read->hasScope('read:jira-user'))->toBeFalse()
        ->and($broken->isActive())->toBeFalse()
        ->and(fn () => $broken->ensureActive())->toThrow(ReconnectRequired::class)
        ->and(fn () => $setup->ensureActive())->toThrow(NotConnected::class)
        ->and(fn () => $read->ensureWritable())->toThrow(ReadOnlyConnection::class)
        ->and(TeamIntegration::factory()->linear()->create()->site())->toBe('org-1')
        ->and(TeamIntegration::factory()->telegram()->create()->site())->toBeNull();
});

it('finds the active integration of an enabled provider only', function () {
    $integration = TeamIntegration::factory()->slack()->create();
    $availability = resolve(IntegrationAvailability::class);

    expect($availability->activeIntegration($integration->team, IntegrationProvider::Slack))->toBeNull();

    enableIntegrations(IntegrationProvider::Slack);

    expect($availability->activeIntegration($integration->team, IntegrationProvider::Slack)?->id)->toBe($integration->id);

    $integration->markReconnectRequired('gone');

    expect($availability->activeIntegration($integration->team, IntegrationProvider::Slack))->toBeNull();
});

it('keeps account mappings per member and deletes them with the integration', function () {
    $integration = TeamIntegration::factory()->jira()->create();
    $user = User::factory()->create();
    $mapping = IntegrationUserMapping::factory()->create(['team_integration_id' => $integration->id, 'user_id' => $user->id]);
    $never = IntegrationUserMapping::factory()->neverAssign()->create(['team_integration_id' => $integration->id]);

    expect(fn () => DB::transaction(fn () => IntegrationUserMapping::factory()->create(['team_integration_id' => $integration->id, 'user_id' => $user->id])))
        ->toThrow(UniqueConstraintViolationException::class)
        ->and($integration->accountFor($user)?->id)->toBe($mapping->id)
        ->and($mapping->matched_by)->toBe(IntegrationUserMatch::Email)
        ->and($mapping->isNeverAssign())->toBeFalse()
        ->and($never->isNeverAssign())->toBeTrue();

    $integration->delete();

    expect(IntegrationUserMapping::query()->count())->toBe(0);
});

it('links an action item once per source', function () {
    $item = ActionItem::factory()->create();
    $link = ActionItemExternalLink::factory()->create(['action_item_id' => $item->id]);

    expect(fn () => DB::transaction(fn () => ActionItemExternalLink::factory()->create(['action_item_id' => $item->id])))
        ->toThrow(UniqueConstraintViolationException::class);

    ActionItemExternalLink::factory()->linear()->create(['action_item_id' => $item->id]);

    expect($item->externalLinks()->count())->toBe(2)
        ->and($link->source)->toBe(IntegrationProvider::Jira);
});

it('stores the imported poker task columns', function () {
    $task = PokerTask::factory()->imported()->create();

    $task->forceFill(['needs_sync' => true, 'sync_error' => 'boom', 'synced_at' => now()])->save();

    $fresh = $task->fresh();

    expect($fresh->external_source)->toBe('jira')
        ->and($fresh->external_site)->toBe('cloud-1')
        ->and($fresh->external_key)->toStartWith('PROJ-')
        ->and($fresh->external_refreshed_at)->not->toBeNull()
        ->and($fresh->needs_sync)->toBeTrue()
        ->and($fresh->synced_at)->not->toBeNull();
});

it('records delivery outcomes', function () {
    $delivery = IntegrationDelivery::factory()->create();

    $delivery->markFailed('POST https://hooks.slack.com/services/T0/B0/XYZ returned 404');

    expect($delivery->fresh()->status)->toBe(IntegrationDeliveryStatus::Failed)
        ->and($delivery->fresh()->error)->toBe('POST https://hooks.slack.com/*** returned 404');

    $delivery->markSent(3);

    expect($delivery->fresh()->status)->toBe(IntegrationDeliveryStatus::Sent)
        ->and($delivery->fresh()->recipient_count)->toBe(3)
        ->and($delivery->fresh()->error)->toBeNull()
        ->and($delivery->fresh()->sent_at)->not->toBeNull();
});

it('prunes deliveries older than 90 days', function () {
    IntegrationDelivery::factory()->create(['created_at' => now()->subDays(91)]);
    $recent = IntegrationDelivery::factory()->create(['created_at' => now()->subDays(89)]);

    $this->artisan('model:prune', ['--model' => [IntegrationDelivery::class]])->assertSuccessful();

    expect(IntegrationDelivery::query()->pluck('id')->all())->toBe([$recent->id]);
});

it('deletes deliveries with their retro or poker game', function () {
    $retro = Retro::factory()->create();
    $game = PokerGame::factory()->create(['team_id' => $retro->team_id]);
    IntegrationDelivery::factory()->forSubject($retro)->create();
    $gameDelivery = IntegrationDelivery::factory()->forSubject($game)->create();

    $retro->delete();

    expect(IntegrationDelivery::query()->pluck('id')->all())->toBe([$gameDelivery->id]);

    $game->delete();

    expect(IntegrationDelivery::query()->count())->toBe(0);
});
