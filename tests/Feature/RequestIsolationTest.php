<?php

use App\Enums\WorkspaceRole;
use App\Models\User;
use App\Models\Workspace;
use Inertia\Testing\AssertableInertia as Assert;

it('resolves the locale again on every request served by the same application', function () {
    $this->get(route('login'), ['Accept-Language' => 'de'])
        ->assertInertia(fn (Assert $page) => $page->where('locale', 'de'));

    $this->get(route('login'), ['Accept-Language' => 'en-US'])
        ->assertInertia(fn (Assert $page) => $page->where('locale', 'en'));
});

it('does not carry the previous user into the next request', function () {
    $first = User::factory()->create(['locale' => 'fr']);
    $second = User::factory()->create(['locale' => 'es']);
    Workspace::factory()->withMember($first, WorkspaceRole::Admin)->create();
    Workspace::factory()->withMember($second, WorkspaceRole::Admin)->create();

    $this->actingAs($first)
        ->followingRedirects()
        ->get(route('dashboard'))
        ->assertInertia(fn (Assert $page) => $page
            ->where('auth.user.id', $first->id)
            ->where('locale', 'fr'));

    $this->actingAs($second)
        ->followingRedirects()
        ->get(route('dashboard'))
        ->assertInertia(fn (Assert $page) => $page
            ->where('auth.user.id', $second->id)
            ->where('locale', 'es'));
});

it('uses octane with the frankenphp server', function () {
    expect(config('octane.server'))->toBe('frankenphp');
});
