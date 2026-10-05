<?php

use App\Actions\Teams\PresentNewSessionOptions;
use App\Enums\WorkspaceRole;
use App\Models\Team;
use Inertia\Testing\AssertableInertia as Assert;

it('gives the team page the options of the dialog from one place', function () {
    $team = Team::factory()->create();
    $member = teamMember($team);
    $options = resolve(PresentNewSessionOptions::class)->handle($member, $team->workspace, $team);

    expect(array_keys($options))->toEqualCanonicalizing([
        'templateCategories', 'topTemplates', 'catalogue', 'canSaveTemplate', 'canCreateRetro', 'icebreakerGames', 'gameOptions',
        'canCreateGameRoom', 'roomLimit', 'pokerDecks', 'defaultPokerDeck', 'pokerDeckOptions', 'canCreatePokerGame',
        'canCreateWhiteboard', 'whiteboardGallery', 'surveys', 'canCreateSurvey', 'surveyTemplates', 'pokerSources',
        'currentSprintNumber', 'retroFacilitators', 'suggestedFacilitatorId', 'facilitatorRotation',
        'defaultRetroTemplate',
    ]);

    $this->actingAs($member)
        ->get(route('teams.show', [$team->workspace, $team]))
        ->assertInertia(fn (Assert $page) => $page
            ->component('teams/show')
            ->where('canCreateRetro', true)
            ->where('canCreatePokerGame', true)
            ->has('topTemplates')
            ->has('pokerDeckOptions')
            ->missing('catalogue'));
});

it('lets only who may share a workspace template save one from the dialog', function () {
    $team = Team::factory()->create();
    $member = teamMember($team);
    $admin = teamMember($team);
    $team->workspace->members()->updateExistingPivot($admin->id, ['role' => WorkspaceRole::Admin->value]);
    $present = resolve(PresentNewSessionOptions::class);

    expect($present->handle($member, $team->workspace, $team)['canSaveTemplate'])->toBeFalse()
        ->and($present->handle($admin->fresh(), $team->workspace, $team)['canSaveTemplate'])->toBeTrue();
});
