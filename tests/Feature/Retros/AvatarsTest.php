<?php

use App\Models\Participant;
use App\Models\User;
use App\Support\Avatars\AvatarUrl;
use Illuminate\Cache\Events\KeyWritten;
use Illuminate\Support\Facades\Event;

it('renders a cacheable svg avatar', function () {
    $response = $this->get(route('avatars.show', str_repeat('a', 32)));

    $response->assertOk()
        ->assertHeader('Content-Type', 'image/svg+xml')
        ->assertHeader('Cache-Control', 'immutable, max-age=31536000, public')
        ->assertHeader('X-Content-Type-Options', 'nosniff')
        ->assertHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; form-action 'none'; sandbox");

    expect($response->getContent())->toStartWith('<svg');
});

it('renders the same avatar for the same seed', function () {
    $seed = str_repeat('b', 32);

    expect($this->get(route('avatars.show', $seed))->getContent())
        ->toBe($this->get(route('avatars.show', $seed))->getContent());
});

it('does not cache avatars to the store', function () {
    Event::fake([KeyWritten::class]);

    $this->get(route('avatars.show', str_repeat('d', 32)))->assertOk();

    Event::assertNotDispatched(KeyWritten::class, fn (KeyWritten $written): bool => str_contains(serialize($written->value), '<svg'));
});

it('rejects malformed seeds', function (string $seed) {
    $this->get("/avatars/{$seed}.svg")->assertNotFound();
})->with(['short', str_repeat('Z', 32), str_repeat('a', 33)]);

it('falls back to the default style when the configured one does not exist', function () {
    $seed = str_repeat('c', 32);
    config(['skrum.avatar_style' => AvatarUrl::DefaultStyle]);
    $defaultAvatar = $this->get(route('avatars.show', $seed))->assertOk()->getContent();

    config(['skrum.avatar_style' => '../../etc/passwd']);

    expect($this->get(route('avatars.show', $seed))->assertOk()->getContent())->toBe($defaultAvatar);
});

it('gives a member the same avatar in every retro', function () {
    $user = User::factory()->create();
    $first = Participant::factory()->create(['user_id' => $user->id]);
    $second = Participant::factory()->create(['user_id' => $user->id]);

    expect($first->avatarSeed())->toBe($second->avatarSeed())
        ->and($first->avatarSeed())->toMatch('/^[a-f0-9]{32}$/')
        ->and($first->avatarSeed())->not->toContain($user->id)
        ->and($first->avatarUrl())->toBe($second->avatarUrl());
});

it('links avatars with a host-relative url', function () {
    $participant = Participant::factory()->guest()->create();

    expect($participant->avatarUrl())->toBe("/avatars/{$participant->avatarSeed()}.svg");
});

it('gives guests their own avatar', function () {
    $first = Participant::factory()->guest()->create();
    $second = Participant::factory()->guest()->create();

    expect($first->avatarSeed())->not->toBe($second->avatarSeed());
});
