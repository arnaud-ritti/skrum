<?php

use App\Events\Poker\PokerTaskDeleted;
use App\Events\Poker\PokerTaskSaved;
use App\Events\Poker\PokerTasksReordered;
use App\Models\PokerGame;
use App\Models\PokerRound;
use App\Models\PokerTask;
use App\Models\User;
use Illuminate\Support\Facades\Event;

beforeEach(function () {
    Event::fake();
});

/**
 * @return array{0: PokerGame, 1: User, 2: User}
 */
function pokerTasksSetup(array $gameAttributes = []): array
{
    $game = PokerGame::factory()->withGuestAccess()->create($gameAttributes);
    [$facilitator] = pokerFacilitator($game);
    [$member] = pokerMember($game);

    return [$game, $facilitator, $member];
}

it('adds tasks as facilitator or member', function () {
    [$game, $facilitator, $member] = pokerTasksSetup();

    $this->actingAs($facilitator)
        ->postJson(route('poker.tasks.store', $game), ['title' => 'Login page', 'description' => 'As a **user**'])
        ->assertCreated()
        ->assertJsonPath('title', 'Login page')
        ->assertJsonPath('position', 1)
        ->assertJsonPath('roundsCount', 0)
        ->assertJsonPath('estimate', null)
        ->assertJsonPath('external', null);

    $this->actingAs($member)
        ->postJson(route('poker.tasks.store', $game), ['title' => 'Signup page'])
        ->assertCreated()
        ->assertJsonPath('position', 2)
        ->assertJsonPath('description', null)
        ->assertJsonPath('descriptionHtml', '');

    expect($game->tasks()->pluck('title')->all())->toBe(['Login page', 'Signup page']);
});

it('validates task fields', function (array $payload, string $field) {
    [$game, $facilitator] = pokerTasksSetup();

    $this->actingAs($facilitator)
        ->postJson(route('poker.tasks.store', $game), $payload)
        ->assertUnprocessable()
        ->assertJsonValidationErrors($field);
})->with([
    'no title' => [['title' => ''], 'title'],
    'long title' => [['title' => str_repeat('a', 201)], 'title'],
    'long description' => [['title' => 'A', 'description' => str_repeat('a', 10001)], 'description'],
]);

it('refuses guests', function () {
    [$game] = pokerTasksSetup();
    $guest = pokerGuest($game);
    $task = PokerTask::factory()->create(['poker_game_id' => $game->id]);

    $this->withCookies(pokerGuestCookie($guest))->withCredentials()
        ->postJson(route('poker.tasks.store', $game), ['title' => 'Sneaky'])
        ->assertForbidden()
        ->assertJsonPath('message', "Guests can't add or edit tasks.");

    $this->withCookies(pokerGuestCookie($guest))->withCredentials()
        ->patchJson(route('poker.tasks.update', [$game, $task]), ['title' => 'Sneaky'])
        ->assertForbidden();

    expect($game->tasks()->count())->toBe(1)
        ->and($task->fresh()->title)->not->toBe('Sneaky');
});

it('edits title and description', function () {
    [$game, , $member] = pokerTasksSetup();
    $task = PokerTask::factory()->create(['poker_game_id' => $game->id, 'title' => 'Old']);

    $this->actingAs($member)
        ->patchJson(route('poker.tasks.update', [$game, $task]), ['description' => 'Now **bold**'])
        ->assertOk()
        ->assertJsonPath('title', 'Old')
        ->assertJsonPath('description', 'Now **bold**')
        ->assertJsonPath('descriptionHtml', fn (string $html) => str_contains($html, '<strong>bold</strong>'));

    $this->actingAs($member)
        ->patchJson(route('poker.tasks.update', [$game, $task]), ['title' => 'New', 'description' => null])
        ->assertOk()
        ->assertJsonPath('title', 'New')
        ->assertJsonPath('description', null);

    Event::assertDispatched(PokerTaskSaved::class, 2);
});

it('answers 404 for a task of another game', function () {
    [$game, $facilitator] = pokerTasksSetup();
    $foreign = PokerTask::factory()->create();

    $this->actingAs($facilitator)
        ->patchJson(route('poker.tasks.update', [$game, $foreign]), ['title' => 'X'])
        ->assertNotFound();
});

it('limits a game to 200 tasks', function () {
    [$game, $facilitator] = pokerTasksSetup();
    PokerTask::factory()->count(200)
        ->sequence(fn ($sequence) => ['position' => $sequence->index + 1])
        ->create(['poker_game_id' => $game->id]);

    $this->actingAs($facilitator)
        ->postJson(route('poker.tasks.store', $game), ['title' => 'One too many'])
        ->assertUnprocessable()
        ->assertJsonPath('errors.title.0', 'This game already has 200 tasks.');

    expect($game->tasks()->count())->toBe(200);
});

it('lets only the facilitator delete and reorder', function () {
    [$game, $facilitator, $member] = pokerTasksSetup();
    $first = PokerTask::factory()->create(['poker_game_id' => $game->id, 'position' => 1]);
    $second = PokerTask::factory()->create(['poker_game_id' => $game->id, 'position' => 2]);

    $this->actingAs($member)->deleteJson(route('poker.tasks.destroy', [$game, $first]))->assertForbidden();
    $this->actingAs($member)
        ->putJson(route('poker.task-order.update', $game), ['task_ids' => [$second->id, $first->id]])
        ->assertForbidden();

    $this->actingAs($facilitator)
        ->putJson(route('poker.task-order.update', $game), ['task_ids' => [$second->id, $first->id]])
        ->assertNoContent();

    expect($game->tasks()->pluck('id')->all())->toBe([$second->id, $first->id]);

    $this->actingAs($facilitator)->deleteJson(route('poker.tasks.destroy', [$game, $first]))->assertNoContent();

    expect(PokerTask::query()->whereKey($first->id)->exists())->toBeFalse();
    Event::assertDispatched(PokerTaskDeleted::class, fn (PokerTaskDeleted $event) => $event->broadcastWith() === ['taskId' => $first->id]);
});

it('clears the current task when it is deleted', function () {
    [$game, $facilitator] = pokerTasksSetup();
    $round = openPokerRound($game);
    [$voter, $voterPlayer] = pokerMember($game);
    pokerVote($round, $voterPlayer, '5');

    $this->actingAs($facilitator)
        ->deleteJson(route('poker.tasks.destroy', [$game, $round->task]))
        ->assertNoContent();

    expect($game->fresh()->current_task_id)->toBeNull()
        ->and(PokerRound::query()->whereKey($round->id)->exists())->toBeFalse();

    $this->actingAs($voter)
        ->getJson(route('poker.snapshot.show', $game))
        ->assertOk()
        ->assertJsonPath('current', null)
        ->assertJsonPath('game.currentTaskId', null);
});

it('refuses stale or foreign task orders', function (string $case) {
    [$game, $facilitator] = pokerTasksSetup();
    $first = PokerTask::factory()->create(['poker_game_id' => $game->id, 'position' => 1]);
    $second = PokerTask::factory()->create(['poker_game_id' => $game->id, 'position' => 2]);
    $foreign = PokerTask::factory()->create();

    $taskIds = match ($case) {
        'missing' => [$second->id],
        'foreign' => [$second->id, $first->id, $foreign->id],
        'duplicate' => [$second->id, $second->id, $first->id],
        'replaced' => [$second->id, $foreign->id],
    };

    $this->actingAs($facilitator)
        ->putJson(route('poker.task-order.update', $game), ['task_ids' => $taskIds])
        ->assertUnprocessable();

    expect($game->tasks()->pluck('id')->all())->toBe([$first->id, $second->id]);
    Event::assertNotDispatched(PokerTasksReordered::class);
})->with(['missing', 'foreign', 'duplicate', 'replaced']);

it('ignores client-sent external fields', function () {
    [$game, $facilitator] = pokerTasksSetup();

    $response = $this->actingAs($facilitator)
        ->postJson(route('poker.tasks.store', $game), [
            'title' => 'Imported?',
            'external_source' => 'jira',
            'external_id' => 'SK-1',
            'external_url' => 'https://evil.example/SK-1',
        ])
        ->assertCreated()
        ->assertJsonPath('external', null);

    $task = PokerTask::query()->findOrFail($response->json('id'));

    $this->actingAs($facilitator)
        ->patchJson(route('poker.tasks.update', [$game, $task]), ['external_id' => 'SK-2'])
        ->assertOk();

    expect($task->fresh()->only(['external_source', 'external_id', 'external_url']))
        ->toBe(['external_source' => null, 'external_id' => null, 'external_url' => null]);
});

it('refuses changes on an ended game', function () {
    [$game, $facilitator] = pokerTasksSetup();
    $task = PokerTask::factory()->create(['poker_game_id' => $game->id]);
    $game->update(['ended_at' => now()]);

    $this->actingAs($facilitator)
        ->postJson(route('poker.tasks.store', $game), ['title' => 'Late'])
        ->assertForbidden()
        ->assertJsonPath('message', 'This game has ended.');
    $this->actingAs($facilitator)->patchJson(route('poker.tasks.update', [$game, $task]), ['title' => 'Late'])->assertForbidden();
    $this->actingAs($facilitator)->deleteJson(route('poker.tasks.destroy', [$game, $task]))->assertForbidden();
    $this->actingAs($facilitator)
        ->putJson(route('poker.task-order.update', $game), ['task_ids' => [$task->id]])
        ->assertForbidden();
});

it('broadcasts task events to others', function () {
    [$game, $facilitator] = pokerTasksSetup();

    $taskId = $this->actingAs($facilitator)
        ->postJson(route('poker.tasks.store', $game), ['title' => 'Broadcast me'])
        ->json('id');
    $other = PokerTask::factory()->create(['poker_game_id' => $game->id, 'position' => 2]);

    $this->actingAs($facilitator)
        ->putJson(route('poker.task-order.update', $game), ['task_ids' => [$other->id, $taskId]])
        ->assertNoContent();

    Event::assertDispatched(PokerTaskSaved::class, fn (PokerTaskSaved $event) => $event->gameId === $game->id
        && $event->broadcastWith()['task']['id'] === $taskId
        && $event->broadcastWith()['task']['title'] === 'Broadcast me');
    Event::assertDispatched(PokerTasksReordered::class, fn (PokerTasksReordered $event) => $event->broadcastWith() === ['taskIds' => [$other->id, $taskId]]);
});
