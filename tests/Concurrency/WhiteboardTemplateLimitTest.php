<?php

use App\Actions\Whiteboards\SaveWhiteboardTemplate;
use App\Actions\Whiteboards\WhiteboardTemplateRules;
use App\Models\Team;
use App\Models\User;
use App\Models\Whiteboard;
use App\Models\WhiteboardTemplate;
use Illuminate\Validation\ValidationException;
use Tests\Concurrency\Support\Race;

/**
 * Two boards of two teams of one workspace save a template each at the same instant.
 *
 * @return array<int, array{ok: bool, value: mixed, error: ?string, message: ?string, startedAt: float, endedAt: float}>
 */
function whiteboardTemplateRace(Team $team, string $firstName, string $secondName): array
{
    $otherTeam = Team::factory()->create(['workspace_id' => $team->workspace_id]);
    $userId = workspaceManager($team->workspace)->id;
    $firstBoardId = Whiteboard::factory()->create(['team_id' => $team->id])->id;
    $secondBoardId = Whiteboard::factory()->create(['team_id' => $otherTeam->id])->id;

    return Race::run([
        static fn (): string => resolve(SaveWhiteboardTemplate::class)
            ->handle(Whiteboard::query()->findOrFail($firstBoardId), User::query()->findOrFail($userId), $firstName, null)->id,
        static fn (): string => resolve(SaveWhiteboardTemplate::class)
            ->handle(Whiteboard::query()->findOrFail($secondBoardId), User::query()->findOrFail($userId), $secondName, null)->id,
    ]);
}

it('stops at fifty whiteboard templates when two boards of one workspace save at the same time', function () {
    $team = Team::factory()->create();
    WhiteboardTemplate::factory()->count(WhiteboardTemplateRules::MaxTemplates - 1)->create(['workspace_id' => $team->workspace_id]);

    $outcomes = whiteboardTemplateRace($team, 'From the first board', 'From the second board');

    expect(WhiteboardTemplate::query()->where('workspace_id', $team->workspace_id)->count())->toBe(WhiteboardTemplateRules::MaxTemplates)
        ->and(array_filter(array_column($outcomes, 'ok')))->toHaveCount(1)
        ->and(collect($outcomes)->firstWhere('ok', false)['error'])->toBe(ValidationException::class);
});

it('keeps one whiteboard template when two boards save the same name at the same time', function () {
    $team = Team::factory()->create();

    $outcomes = whiteboardTemplateRace($team, 'Kick-off', 'kick-off');

    expect(WhiteboardTemplate::query()->where('workspace_id', $team->workspace_id)->count())->toBe(1)
        ->and(array_filter(array_column($outcomes, 'ok')))->toHaveCount(1)
        ->and(collect($outcomes)->firstWhere('ok', false)['error'])->toBe(ValidationException::class);
});
