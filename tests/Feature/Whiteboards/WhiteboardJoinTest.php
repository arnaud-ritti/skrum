<?php

use App\Actions\Retros\GuestCookie;
use App\Models\User;
use App\Models\Whiteboard;
use Inertia\Testing\AssertableInertia as Assert;

it('shows the join form for a valid link', function () {
    $board = Whiteboard::factory()->withGuestAccess()->create(['title' => 'Workshop']);

    $this->get(route('whiteboards.join.show', $board->guest_token))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('whiteboards/join')
            ->where('isInvalid', false)
            ->where('boardTitle', 'Workshop')
            ->where('suggestedName', fn (string $name) => $name !== '' && mb_strlen($name) <= 50)
            ->missing('randomName')
            ->reloadOnly('randomName', fn (Assert $reload) => $reload
                ->where('randomName', fn (string $name) => $name !== '' && mb_strlen($name) <= 50)));
});

it('prefills the name of a signed-in outsider', function () {
    $board = Whiteboard::factory()->withGuestAccess()->create();
    $outsider = User::factory()->create(['name' => 'Olga Outside']);

    $this->actingAs($outsider)
        ->get(route('whiteboards.join.show', $board->guest_token))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page->where('suggestedName', 'Olga Outside'));
});

it('answers 404 for an unknown or disabled link', function () {
    $board = Whiteboard::factory()->create();

    $this->get(route('whiteboards.join.show', $board->guest_token))
        ->assertNotFound()
        ->assertInertia(fn (Assert $page) => $page->component('whiteboards/join')->where('isInvalid', true));

    $this->post(route('whiteboards.join.store', 'unknown'), ['name' => 'Ada'])->assertNotFound();
});

it('creates a guest member and sets the board cookie', function () {
    $board = Whiteboard::factory()->withGuestAccess()->create();

    $response = $this->post(route('whiteboards.join.store', $board->guest_token), ['name' => 'Ada'])
        ->assertRedirect(route('whiteboards.show', $board));

    $guest = $board->members()->sole();

    expect($guest->guest_name)->toBe('Ada')
        ->and($guest->user_id)->toBeNull();

    $response->assertCookie(GuestCookie::name(GuestCookie::WhiteboardScope, $board->id));
});

it('requires a name of at most 50 characters', function (string $name) {
    $board = Whiteboard::factory()->withGuestAccess()->create();

    $this->post(route('whiteboards.join.store', $board->guest_token), ['name' => $name])
        ->assertSessionHasErrors('name');
})->with(['empty' => '', 'too long' => str_repeat('a', 51)]);

it('sends team members straight to the board', function () {
    $board = Whiteboard::factory()->withGuestAccess()->create();

    $this->actingAs(teamMember($board->team))
        ->get(route('whiteboards.join.show', $board->guest_token))
        ->assertRedirect(route('whiteboards.show', $board));
});
