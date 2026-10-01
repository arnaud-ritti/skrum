<?php

use App\Actions\Integrations\TrackedIssues;
use App\Enums\IntegrationProvider;
use App\Models\ActionItem;
use App\Models\ActionItemExternalLink;
use App\Models\PokerGame;
use App\Models\TeamIntegration;
use Carbon\CarbonImmutable;
use Database\Factories\TeamIntegrationFactory;
use Illuminate\Support\Facades\Http;

beforeEach(function () {
    Http::preventStrayRequests();
    $this->travelTo(CarbonImmutable::parse('2026-10-07 10:30:00'));
});

it('lists the tracked ids of links and running game tasks, and the requested ones among them', function () {
    ['integration' => $integration] = statusSyncLink();
    $game = PokerGame::factory()->create(['team_id' => $integration->team_id]);
    importedPokerTask($game, ['external_id' => '20001', 'external_key' => 'TEAM-7']);
    $ended = PokerGame::factory()->create(['team_id' => $integration->team_id, 'ended_at' => now()->subDay()]);
    importedPokerTask($ended, ['external_id' => '20002', 'external_key' => 'GONE-1']);

    $tracked = resolve(TrackedIssues::class);
    $ids = $tracked->ids($integration);
    sort($ids);

    expect($ids)->toBe(['10001', '20001'])
        ->and($tracked->among($integration, ['20001', '20002', '99999']))->toBe(['20001'])
        ->and($tracked->among($integration, []))->toBeEmpty()
        ->and($tracked->containerKeys($integration))->toBe(['PROJ', 'TEAM']);
});

it('lists the tracked GitHub issues of given repositories only', function () {
    enableIntegrations(IntegrationProvider::GitHub);
    $integration = TeamIntegration::factory()->gitHub()->create();
    foreach (['555/1', '555/2', '777/3'] as $externalId) {
        ActionItemExternalLink::factory()->create([
            'action_item_id' => ActionItem::factory()->create(['team_id' => $integration->team_id])->id,
            'source' => IntegrationProvider::GitHub,
            'external_site' => TeamIntegrationFactory::GitHubInstallationId,
            'external_id' => $externalId,
        ]);
    }

    $found = resolve(TrackedIssues::class)->inRepositories($integration, ['555', 'not-a-repo']);
    sort($found);

    expect($found)->toBe(['555/1', '555/2'])
        ->and(resolve(TrackedIssues::class)->inRepositories($integration, ['5%']))->toBeEmpty();
});

it('tracks nothing for a connection without a site', function () {
    ['integration' => $integration, 'link' => $link] = statusSyncLink(['external_site' => '']);
    $integration->forceFill(['settings' => [...$integration->settings, 'cloudId' => null]])->save();

    expect(resolve(TrackedIssues::class)->ids($integration))->toBeEmpty()
        ->and(resolve(TrackedIssues::class)->links($integration)->count())->toBe(0)
        ->and($link->external_site)->toBeEmpty();
});
