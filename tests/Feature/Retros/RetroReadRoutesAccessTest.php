<?php

use App\Enums\RetroPhase;
use App\Enums\TeamRole;
use App\Enums\WorkspaceRole;
use App\Models\ActionItem;
use App\Models\Retro;
use App\Models\Survey;
use App\Models\User;
use App\Models\Workspace;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Http;

beforeEach(function () {
    Event::fake();
    config(['services.gifs' => ['provider' => 'giphy', 'key' => 'secret-key', 'rating' => 'pg']]);
    Http::fake(['api.giphy.com/v1/gifs/trending*' => Http::response(['data' => []])]);
});

dataset('retro json reads', ['snapshot', 'gif search', 'attached survey', 'action item comments']);

/**
 * @return array{0: Retro, 1: string}
 */
function retroJsonRead(string $read): array
{
    $retro = Retro::factory()->inPhase(RetroPhase::Writing)->withGuestAccess()->create();

    $url = match ($read) {
        'snapshot' => route('retros.snapshot.show', $retro),
        'gif search' => route('retros.gifs.index', $retro),
        'attached survey' => route('retros.surveys.show', [$retro, Survey::factory()->withOptions()->create(['retro_id' => $retro->id])]),
        'action item comments' => route('retros.action-items.comments.index', [$retro, ActionItem::factory()->create(['retro_id' => $retro->id])]),
    };

    return [$retro, $url];
}

it('answers the json reads of a retro to its members, its guests and its observers', function (string $read) {
    [$retro, $url] = retroJsonRead($read);
    [$member] = retroMember($retro);
    $guest = retroGuest($retro);
    $observer = teamMember($retro->team, TeamRole::Observer);

    $this->actingAs($member)->getJson($url)->assertOk();
    $this->actingAs($observer)->getJson($url)->assertOk();

    auth()->logout();

    $this->withCookies(retroGuestCookie($guest))->withCredentials()->getJson($url)->assertOk();
})->with('retro json reads');

it('refuses the json reads of a retro to a workspace member outside its team and to another workspace', function (string $read) {
    [$retro, $url] = retroJsonRead($read);
    $outsider = User::factory()->create();
    $retro->team->workspace->members()->attach($outsider, ['role' => WorkspaceRole::Member->value]);
    $stranger = User::factory()->create();
    Workspace::factory()->withMember($stranger, WorkspaceRole::Owner)->create();

    $this->actingAs($outsider)->getJson($url)
        ->assertForbidden()
        ->assertJsonPath('message', 'You no longer have access to this retrospective.');

    $this->actingAs($stranger)->getJson($url)
        ->assertForbidden()
        ->assertJsonPath('message', 'You no longer have access to this retrospective.');
})->with('retro json reads');

it('answers the json reads of a retro with 401 to a visitor without a session', function (string $read) {
    [, $url] = retroJsonRead($read);

    $this->getJson($url)
        ->assertUnauthorized()
        ->assertJsonPath('message', 'Your session has expired.');
})->with('retro json reads');
