<?php

use App\Actions\ActionItems\ActionItemActor;
use App\Actions\ActionItems\CreateActionItem;
use App\Actions\Retros\PresentActionItem;
use App\Enums\RetroPhase;
use App\Events\Retros\ActionItemDeleted;
use App\Events\Retros\ActionItemSaved;
use App\Models\ActionItem;
use App\Models\Participant;
use App\Models\Retro;
use App\Models\RetroTheme;
use Illuminate\Support\Facades\Event;

beforeEach(function () {
    Event::fake();
});

it('creates, assigns, completes and deletes action items while discussing', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Discussing)->create();
    [$user, $participant] = retroMember($retro);

    $id = $this->actingAs($user)
        ->postJson(route('retros.action-items.store', $retro), ['content' => 'Speed up CI', 'assignee_participant_id' => $participant->id])
        ->assertCreated()
        ->assertJsonPath('actionItem.assignee.id', $user->id)
        ->json('actionItem.id');

    $this->actingAs($user)
        ->patchJson(route('retros.action-items.update', [$retro, $id]), ['is_done' => true, 'assignee_participant_id' => null])
        ->assertOk()
        ->assertJsonPath('actionItem.status', 'completed')
        ->assertJsonPath('actionItem.assignee', null);

    $this->actingAs($user)->deleteJson(route('retros.action-items.destroy', [$retro, $id]))->assertNoContent();

    expect(ActionItem::find($id))->toBeNull();
    Event::assertDispatched(ActionItemSaved::class, 2);
    Event::assertDispatched(ActionItemDeleted::class, fn (ActionItemDeleted $event) => $event->actionItemId === $id);
});

it('lets guests manage action items', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Discussing)->withGuestAccess()->create();
    $guest = Participant::factory()->guest()->create(['retro_id' => $retro->id]);

    $this->withCookies(retroGuestCookie($guest))
        ->withCredentials()
        ->postJson(route('retros.action-items.store', $retro), ['content' => 'From a guest'])
        ->assertCreated();
});

it('keeps completed retros read-only and other phases closed', function (RetroPhase $phase) {
    $retro = Retro::factory()->inPhase($phase)->create();
    [$user] = retroMember($retro);
    $item = ActionItem::factory()->create(['retro_id' => $retro->id]);

    $this->actingAs($user)->postJson(route('retros.action-items.store', $retro), ['content' => 'X'])->assertForbidden();
    $this->actingAs($user)->patchJson(route('retros.action-items.update', [$retro, $item]), ['is_done' => true])->assertForbidden();
    $this->actingAs($user)->deleteJson(route('retros.action-items.destroy', [$retro, $item]))->assertForbidden();
})->with([RetroPhase::Voting, RetroPhase::Completed]);

it('only assigns participants of the same retro', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Discussing)->create();
    [$user] = retroMember($retro);

    $this->actingAs($user)
        ->postJson(route('retros.action-items.store', $retro), ['content' => 'X', 'assignee_participant_id' => Participant::factory()->create()->id])
        ->assertUnprocessable();
});

it('validates content length', function (string $content) {
    $retro = Retro::factory()->inPhase(RetroPhase::Discussing)->create();
    [$user] = retroMember($retro);

    $this->actingAs($user)->postJson(route('retros.action-items.store', $retro), ['content' => $content])->assertUnprocessable();
})->with(['', str_repeat('a', 501)]);

it('returns 404 for action items of another retro', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Discussing)->create();
    [$user] = retroMember($retro);

    $this->actingAs($user)
        ->patchJson(route('retros.action-items.update', [$retro, ActionItem::factory()->create()]), ['is_done' => true])
        ->assertNotFound();
});

it('creates action items through the shared action', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Discussing)->create();
    [, $author] = retroMember($retro);
    $theme = RetroTheme::factory()->create(['retro_id' => $retro->id, 'name' => 'Release pain']);

    $item = app(CreateActionItem::class)->handle($retro->team, $retro, ActionItemActor::forParticipant($author), ['content' => 'Automate the release'], $theme);

    expect($item->only(['content', 'created_by_participant_id', 'theme_id', 'theme_name']))->toBe([
        'content' => 'Automate the release',
        'created_by_participant_id' => $author->id,
        'theme_id' => $theme->id,
        'theme_name' => 'Release pain',
    ]);
});

it('keeps the theme name of an action item after its theme is removed', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Discussing)->create();
    $theme = RetroTheme::factory()->create(['retro_id' => $retro->id, 'name' => 'Release pain']);
    $item = ActionItem::factory()->create(['retro_id' => $retro->id, 'theme_id' => $theme->id, 'theme_name' => 'Release pain']);

    expect(app(PresentActionItem::class)->handle($item->fresh()))->toMatchArray(['themeId' => $theme->id, 'themeName' => 'Release pain']);

    $theme->delete();

    expect(app(PresentActionItem::class)->handle($item->fresh()))->toMatchArray(['themeId' => null, 'themeName' => 'Release pain']);
});

it('never lets clients write the theme of an action item', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Discussing)->create();
    [$user] = retroMember($retro);
    $theme = RetroTheme::factory()->create(['retro_id' => $retro->id]);

    $id = $this->actingAs($user)
        ->postJson(route('retros.action-items.store', $retro), ['content' => 'X', 'theme_id' => $theme->id, 'theme_name' => 'Forged'])
        ->assertCreated()
        ->json('actionItem.id');

    expect(ActionItem::find($id)->only(['theme_id', 'theme_name']))->toBe(['theme_id' => null, 'theme_name' => null]);
});
