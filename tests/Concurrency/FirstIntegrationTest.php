<?php

use App\Actions\Integrations\SaveTeamIntegration;
use App\Enums\IntegrationAccess;
use App\Enums\IntegrationProvider;
use App\Enums\IntegrationStatus;
use App\Models\Team;
use App\Models\TeamIntegration;
use App\Models\User;
use Tests\Concurrency\Support\Race;

it('keeps one integration when a provider is connected six times at once for the first time', function () {
    $team = Team::factory()->create();
    $teamId = $team->id;
    $userId = integrationAdmin($team)->id;

    $outcomes = Race::run(array_fill(0, 6, static fn (): string => resolve(SaveTeamIntegration::class)->handle(
        Team::query()->findOrFail($teamId),
        IntegrationProvider::Telegram,
        User::query()->findOrFail($userId),
        [
            'status' => IntegrationStatus::Active,
            'access' => IntegrationAccess::Write,
            'credentials' => [],
            'settings' => ['chatId' => '42', 'chatTitle' => 'Team chat', 'chatType' => 'group'],
            'scopes' => [],
        ],
    )->id));

    expect(array_column($outcomes, 'error'))->each->toBeNull()
        ->and(TeamIntegration::query()->where('team_id', $teamId)->count())->toBe(1)
        ->and(array_unique(array_column($outcomes, 'value')))->toHaveCount(1);
});
