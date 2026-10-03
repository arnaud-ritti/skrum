<?php

use App\Actions\Teams\AnswerTeamAccessRequest;
use App\Actions\Teams\RequestTeamAccess;
use App\Enums\WorkspaceRole;
use App\Models\Team;
use App\Models\TeamAccessRequest;
use App\Models\User;
use Tests\Concurrency\Support\Race;

it('makes one pending request when the same person asks twice at once', function () {
    $team = Team::factory()->create();
    $user = User::factory()->create();
    $team->workspace->members()->attach($user, ['role' => WorkspaceRole::Member->value]);
    [$teamId, $userId] = [$team->id, $user->id];

    $outcomes = Race::run([
        static fn () => resolve(RequestTeamAccess::class)->handle(User::query()->findOrFail($userId), Team::query()->findOrFail($teamId), 'a')->id,
        static fn () => resolve(RequestTeamAccess::class)->handle(User::query()->findOrFail($userId), Team::query()->findOrFail($teamId), 'b')->id,
    ]);

    expect(array_column($outcomes, 'ok'))->each->toBeTrue()
        ->and(TeamAccessRequest::query()->count())->toBe(1);
});

it('gives one outcome to an approval and a decline at once', function () {
    $team = Team::factory()->create();
    $request = TeamAccessRequest::factory()->for($team)->pending()->create();
    [$requestId, $firstId, $secondId] = [$request->id, workspaceManager($team->workspace)->id, workspaceManager($team->workspace)->id];

    $outcomes = Race::run([
        static fn () => resolve(AnswerTeamAccessRequest::class)->handle(User::query()->findOrFail($firstId), TeamAccessRequest::query()->findOrFail($requestId), true)->value,
        static fn () => resolve(AnswerTeamAccessRequest::class)->handle(User::query()->findOrFail($secondId), TeamAccessRequest::query()->findOrFail($requestId), false)->value,
    ]);

    $final = TeamAccessRequest::query()->findOrFail($requestId);

    expect(collect($outcomes)->where('ok', true))->toHaveCount(1)
        ->and($team->hasMember($final->user))->toBe($final->status->value === 'approved');
});
