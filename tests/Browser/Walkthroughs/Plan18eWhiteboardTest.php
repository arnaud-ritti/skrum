<?php

use App\Models\User;
use App\Models\WhiteboardMember;

it('[P18e-07-01] prefills the name on the guest-join page, lets the visitor in with "Join", and shows the notice for an invalid link', function () {
    ['board' => $board] = whiteboardWithFacilitator();
    whiteboardGuest($board);
    $oscar = renamedWhiteboardUser(User::factory()->create(), 'Oscar Outsider');
    $joinPath = $this->whiteboardJoinPath($board);

    $page = $this->signIn($oscar, $joinPath);

    $page->assertPathIs($joinPath)
        ->assertSee('Join as a guest')
        ->assertSeeIn('[data-slot="guest-join-session"][data-kind="whiteboard"]', 'Sprint board')
        ->assertSeeIn('[data-slot="guest-join-status"]', 'Live')
        ->assertSeeIn('[data-slot="guest-join-participants"]', '2 participants')
        ->assertSeeIn('[data-slot="guest-join-facilitator"]', 'Fran Facilitator facilitates')
        ->assertValue('#name', 'Oscar Outsider')
        ->click('Join')
        ->assertPathIs($this->whiteboardPath($board));

    $this->awaitRealtime($page)
        ->assertPresent('header img[data-presence-id][alt="Oscar Outsider"]');

    expect(WhiteboardMember::query()->where('whiteboard_id', $board->id)->where('guest_name', 'Oscar Outsider')->count())->toBe(1);

    $board->update(['guest_access_enabled' => false]);

    $visitorPage = visit($joinPath);

    $visitorPage->assertSee('Join a whiteboard')
        ->assertSee('This guest link is no longer valid.')
        ->assertNotPresent('#name')
        ->assertNotPresent('[data-slot="guest-join"]');
});
