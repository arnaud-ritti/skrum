<?php

use App\Enums\WorkspaceRole;
use App\Models\Team;
use App\Models\User;
use App\Models\Whiteboard;

it('creates a board and makes the creator its facilitator', function () {
    $team = Team::factory()->create();
    $user = teamMember($team);

    $response = $this->actingAs($user)
        ->post(route('teams.whiteboards.store', [$team->workspace, $team]), ['title' => 'Discovery']);

    $board = Whiteboard::query()->sole();

    $response->assertRedirect(route('whiteboards.show', $board));

    expect($board->title)->toBe('Discovery')
        ->and($board->team_id)->toBe($team->id)
        ->and(strlen($board->guest_token))->toBe(40)
        ->and($board->facilitator?->user_id)->toBe($user->id)
        ->and($board->elements()->count())->toBe(0);
});

it('requires a title of at most 120 characters', function (string $title) {
    $team = Team::factory()->create();

    $this->actingAs(teamMember($team))
        ->post(route('teams.whiteboards.store', [$team->workspace, $team]), ['title' => $title])
        ->assertSessionHasErrors('title');

    expect(Whiteboard::query()->count())->toBe(0);
})->with(['empty' => '', 'too long' => str_repeat('a', 121)]);

it('refuses people who cannot view the team', function () {
    $team = Team::factory()->create();
    $outsider = User::factory()->create();
    $team->workspace->members()->attach($outsider, ['role' => WorkspaceRole::Member->value]);

    $this->actingAs($outsider)
        ->post(route('teams.whiteboards.store', [$team->workspace, $team]), ['title' => 'Nope'])
        ->assertForbidden();
});

it('stores the guest access flag of a board, false by default', function () {
    $team = Team::factory()->create();
    $user = teamMember($team);
    $url = route('teams.whiteboards.store', [$team->workspace, $team]);

    $this->actingAs($user)->post($url, ['title' => 'Open', 'guest_access_enabled' => true]);
    $this->actingAs($user)->post($url, ['title' => 'Closed']);

    expect(Whiteboard::query()->where('title', 'Open')->sole()->guest_access_enabled)->toBeTrue()
        ->and(Whiteboard::query()->where('title', 'Closed')->sole()->guest_access_enabled)->toBeFalse();
});
