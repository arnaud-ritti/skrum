<?php

use App\Enums\TeamRole;
use App\Models\Onboarding;
use App\Models\Team;
use App\Models\Workspace;
use App\Support\Teams\TeamSlug;
use Illuminate\Support\Facades\Event;

it('derives a slug from a name', function (string $name, string $slug) {
    expect(TeamSlug::fromName($name))->toBe($slug);
})->with([
    ['Atlas', 'atlas'],
    ['  Équipe  Nord ', 'equipe-nord'],
    ['!!!', 'team'],
    ['A', 'team'],
    [str_repeat('platform ', 10), 'platform-platform-platform-platform-platform'],
]);

it('keeps a numbered slug within fifty characters', function () {
    $base = str_repeat('a', 50);

    expect(TeamSlug::firstFree($base, [$base]))->toBe(str_repeat('a', 48).'-2')
        ->and(TeamSlug::firstFree('atlas', ['atlas', 'atlas-2']))->toBe('atlas-3');
});

it('gives a new team a slug unique in its workspace, and the same slug in another workspace', function () {
    $workspace = Workspace::factory()->create();
    $first = Team::factory()->for($workspace)->create(['name' => 'Atlas']);
    $second = Team::factory()->for($workspace)->create(['name' => 'atlas']);
    $elsewhere = Team::factory()->create(['name' => 'Atlas']);

    expect($first->slug)->toBe('atlas')
        ->and($second->slug)->toBe('atlas-2')
        ->and($elsewhere->slug)->toBe('atlas');
});

it('gives a new team its slug while events are faked or muted', function () {
    $workspace = Workspace::factory()->create();
    Event::fake();

    $faked = Team::factory()->for($workspace)->create(['name' => 'Atlas']);
    $quiet = Team::factory()->for($workspace)->createQuietly(['name' => 'Atlas']);

    expect($faked->slug)->toBe('atlas')
        ->and($quiet->slug)->toBe('atlas-2');
});

it('creates a team from the workspace page with a derived slug', function () {
    $workspace = Workspace::factory()->create();

    $this->actingAs(workspaceManager($workspace))
        ->post(route('teams.store', $workspace), ['name' => 'Atlas'])
        ->assertRedirect();

    expect($workspace->teams()->sole()->slug)->toBe('atlas');
});

it('keeps the slug when the team is renamed', function () {
    $team = Team::factory()->create(['name' => 'Atlas']);

    $this->actingAs(workspaceManager($team->workspace))
        ->patch(route('teams.update', [$team->workspace, $team]), ['name' => 'Atlas Platform'])
        ->assertSessionHasNoErrors();

    expect($team->fresh()->slug)->toBe('atlas');
});

it('lets who may update the team edit its slug, checked for form and uniqueness', function (string $slug, ?string $error) {
    $team = Team::factory()->create(['name' => 'Atlas']);
    Team::factory()->for($team->workspace)->create(['name' => 'Borealis']);

    $response = $this->actingAs(teamInviter($team))
        ->patch(route('teams.update', [$team->workspace, $team]), ['name' => 'Atlas', 'slug' => $slug]);

    if ($error === null) {
        $response->assertSessionHasNoErrors();
        expect($team->fresh()->slug)->toBe($slug);

        return;
    }

    $response->assertSessionHasErrors('slug');
    expect($team->fresh()->slug)->toBe('atlas');
})->with([
    'valid' => ['atlas-core', null],
    'taken in the workspace' => ['borealis', 'slug'],
    'capitals' => ['Atlas', 'slug'],
    'double hyphen' => ['atlas--core', 'slug'],
    'too short' => ['a', 'slug'],
    'too long' => [str_repeat('a', 51), 'slug'],
]);

it('refuses a slug edit to who may not update the team', function (TeamRole $role) {
    $team = Team::factory()->create(['name' => 'Atlas']);

    $this->actingAs(teamMember($team, $role))
        ->patch(route('teams.update', [$team->workspace, $team]), ['name' => 'Atlas', 'slug' => 'mine'])
        ->assertForbidden();
})->with([TeamRole::Facilitator, TeamRole::Member, TeamRole::Observer]);

it('creates the onboarding team with the slug typed at step two, or a derived one', function (?string $slug, string $expected) {
    $onboarding = Onboarding::factory()->create();
    $this->actingAs($onboarding->user)->put(route('onboarding.workspace.update'), ['name' => 'Nordlys', 'locale' => 'en']);

    $this->actingAs($onboarding->user)
        ->put(route('onboarding.team.update'), array_filter(['name' => 'Atlas', 'color' => 'lagoon', 'slug' => $slug]))
        ->assertSessionHasNoErrors();

    expect($onboarding->fresh()->team->slug)->toBe($expected);
})->with([
    [null, 'atlas'],
    ['atlas-team', 'atlas-team'],
]);

it('edits the onboarding team slug on a second continue and keeps it on a rename alone', function () {
    $onboarding = Onboarding::factory()->create();
    $this->actingAs($onboarding->user)->put(route('onboarding.workspace.update'), ['name' => 'Nordlys', 'locale' => 'en']);
    $this->actingAs($onboarding->user)->put(route('onboarding.team.update'), ['name' => 'Atlas', 'color' => 'lagoon']);

    $this->actingAs($onboarding->user)
        ->put(route('onboarding.team.update'), ['name' => 'Atlas Core', 'color' => 'lagoon'])
        ->assertSessionHasNoErrors();
    $renamedSlug = $onboarding->fresh()->team->slug;

    $this->actingAs($onboarding->user)
        ->put(route('onboarding.team.update'), ['name' => 'Atlas Core', 'color' => 'lagoon', 'slug' => 'atlas-core'])
        ->assertSessionHasNoErrors();

    expect($renamedSlug)->toBe('atlas')
        ->and($onboarding->fresh()->team->slug)->toBe('atlas-core');
});

it('refuses at step two a slug the workspace already has', function () {
    $onboarding = Onboarding::factory()->create();
    $this->actingAs($onboarding->user)->put(route('onboarding.workspace.update'), ['name' => 'Nordlys', 'locale' => 'en']);
    Team::factory()->for($onboarding->fresh()->workspace)->create(['name' => 'Borealis']);

    $this->actingAs($onboarding->user)
        ->put(route('onboarding.team.update'), ['name' => 'Atlas', 'color' => 'lagoon', 'slug' => 'borealis'])
        ->assertSessionHasErrors('slug');

    expect($onboarding->fresh()->team_id)->toBeNull();
});

it('sends the team slug and its address to the team page', function () {
    $team = Team::factory()->create(['name' => 'Atlas']);

    $this->actingAs(teamMember($team))
        ->get(route('teams.show', [$team->workspace, $team]))
        ->assertInertia(fn ($page) => $page
            ->where('team.slug', 'atlas')
            ->where('team.address', url('/t/atlas')));
});
