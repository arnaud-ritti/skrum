<?php

use App\Models\Team;
use App\Models\TeamInviteLink;
use Illuminate\Support\Facades\DB;

it('keeps the token encrypted and finds the link by its hash', function () {
    $link = TeamInviteLink::factory()->withToken('link-token-0123456789abcdefghijklmnopqrstu')->create();

    expect(DB::table('team_invite_links')->value('token'))->not->toContain('link-token')
        ->and($link->fresh()->token)->toBe('link-token-0123456789abcdefghijklmnopqrstu')
        ->and(TeamInviteLink::findByToken('link-token-0123456789abcdefghijklmnopqrstu')?->is($link))->toBeTrue()
        ->and(TeamInviteLink::findByToken('other'))->toBeNull()
        ->and($link->toArray())->not->toHaveKeys(['token', 'token_hash']);
});

it('is usable until it expires or is turned off', function (string $state, bool $usable) {
    $factory = TeamInviteLink::factory();
    $link = ($state === 'fresh' ? $factory : $factory->{$state}())->create();

    expect($link->isUsable())->toBe($usable);
})->with([
    ['fresh', true],
    ['expired', false],
    ['revoked', false],
]);

it('stays usable however many people joined through it', function () {
    expect(TeamInviteLink::factory()->joinedBy(10_000)->create()->isUsable())->toBeTrue();
});

it('gives a team its one usable link', function () {
    $team = Team::factory()->create();
    TeamInviteLink::factory()->for($team)->revoked()->create();
    $usable = TeamInviteLink::factory()->for($team)->create();

    expect($team->usableInviteLink()?->is($usable))->toBeTrue()
        ->and(Team::factory()->create()->usableInviteLink())->toBeNull();
});

it('goes with its team', function () {
    $link = TeamInviteLink::factory()->create();

    $link->team->delete();

    expect(TeamInviteLink::query()->count())->toBe(0);
});
