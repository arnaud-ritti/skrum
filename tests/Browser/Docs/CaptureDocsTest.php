<?php

use App\Enums\TeamRole;
use App\Enums\WorkspaceRole;
use Illuminate\Support\Facades\File;
use Tests\Browser\Support\DocsWorld;

afterEach(function () {
    File::deleteDirectory(base_path('website/src/assets/screenshots/_selftest'));
});

it('gives the story its workspace, its team, eight people with their roles and three sprints', function () {
    $world = DocsWorld::create();

    $workspaceAdmins = $world->workspace->members()->wherePivot('role', WorkspaceRole::Admin->value)->pluck('users.name')->all();
    $teamRole = fn (TeamRole $role): array => $world->team->members()->wherePivot('role', $role->value)->pluck('users.name')->all();

    expect($world->workspace->only('name', 'slug'))->toBe(['name' => 'Nordlys', 'slug' => 'nordlys'])
        ->and($world->team->only('name', 'slug'))->toBe(['name' => 'Atlas', 'slug' => 'atlas'])
        ->and($world->people->keys()->all())->toBe(['Camille', 'Théo', 'Inès', 'Malik', 'Sofia', 'Noa', 'Lucas', 'Yuki'])
        ->and($world->person('Inès')->email)->toBe('ines@nordlys.example')
        ->and($workspaceAdmins)->toBe(['Camille Roux'])
        ->and($teamRole(TeamRole::Owner))->toBe(['Camille Roux'])
        ->and($teamRole(TeamRole::Facilitator))->toBe(['Théo Martin'])
        ->and($teamRole(TeamRole::Observer))->toBe(['Yuki Tanaka'])
        ->and($world->team->members()->count())->toBe(8)
        ->and($world->team->sprints()->orderBy('number')->pluck('number')->all())->toBe([41, 42, 43]);
});

it('saves an element of the team page at twice its size and keeps the file when nothing changed', function () {
    $world = DocsWorld::create();
    $picture = base_path('website/src/assets/screenshots/_selftest/team-page.png');

    $page = $this->docsVisit($world->person('Camille'), route('teams.show', [$world->workspace, $world->team], false))
        ->assertPresent('[data-slot="team-page"]');

    $this->docShot($page, '_selftest/team-page', '[data-slot="team-page"]');

    $width = (int) $page->script('() => Math.round(document.querySelector(\'[data-slot="team-page"]\').getBoundingClientRect().width)');
    $firstCapture = hash_file('xxh128', $picture);

    $this->docShot($page, '_selftest/team-page', '[data-slot="team-page"]');

    expect(getimagesize($picture)[0])->toBe($width * 2)
        ->and(hash_file('xxh128', $picture))->toBe($firstCapture)
        ->and(File::glob(base_path('tests/Browser/Screenshots/docs-*')))->toBe([]);
});

it('signs a second person of the story in and opens a page signed out', function () {
    $world = DocsWorld::create();
    $path = route('teams.show', [$world->workspace, $world->team], false);

    $this->docsVisit($world->person('Camille'), $path)->assertPresent('[data-slot="team-page"]');
    $this->docsVisit($world->person('Yuki'), $path)->assertPresent('[data-slot="team-page"]');
    $this->docsOpen('/login')->assertPresent('#email');
});

it('leaves nothing behind when the element is missing', function () {
    $world = DocsWorld::create();

    $page = $this->docsVisit($world->person('Camille'), route('teams.show', [$world->workspace, $world->team], false))
        ->assertPresent('[data-slot="team-page"]');

    expect(fn () => $this->docShot($page, '_selftest/missing', '[data-slot="no-such-slot"]'))->toThrow(RuntimeException::class, '[data-slot="no-such-slot"]')
        ->and(File::glob(base_path('tests/Browser/Screenshots/docs-*')))->toBe([])
        ->and(is_file(base_path('website/src/assets/screenshots/_selftest/missing.png')))->toBeFalse();
});
