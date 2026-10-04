<?php

use App\Models\User;

it('limits declining invitations to ten a minute from one address of origin', function () {
    foreach (range(1, 10) as $attempt) {
        $this->post(route('invitations.decline.store', "unknown-{$attempt}"))->assertNotFound();
    }

    $this->post(route('invitations.decline.store', 'unknown-11'))->assertTooManyRequests();
});

it('limits opening invite links to thirty a minute from one address of origin', function () {
    foreach (range(1, 30) as $attempt) {
        $this->get(route('inviteLinks.show', "unknown-link-{$attempt}"))->assertNotFound();
    }

    $this->get(route('inviteLinks.show', 'unknown-link-31'))->assertTooManyRequests();
});

it('limits joining by an invite link to ten a minute for one account', function () {
    $user = User::factory()->create();

    foreach (range(1, 10) as $attempt) {
        $this->actingAs($user)->post(route('inviteLinks.membership.store', "unknown-link-{$attempt}"))->assertNotFound();
    }

    $this->actingAs($user)->post(route('inviteLinks.membership.store', 'unknown-link-11'))->assertTooManyRequests();
});
