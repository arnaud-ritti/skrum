<?php

use App\Actions\Retros\BuildBoardSnapshot;
use App\Actions\Retros\PresentCard;
use App\Actions\Retros\StoreRetroInsights;
use App\Actions\Retros\SummaryOutput;
use App\Enums\CardSentiment;
use App\Enums\RetroPhase;
use App\Enums\SuggestedActionStatus;
use App\Enums\SummaryStatus;
use App\Enums\WorkspaceRole;
use App\Events\Retros\ActionItemSaved;
use App\Events\Retros\InsightsChanged;
use App\Models\ActionItem;
use App\Models\Card;
use App\Models\Participant;
use App\Models\Retro;
use App\Models\RetroTheme;
use App\Models\SuggestedAction;
use App\Models\User;
use Illuminate\Support\Facades\Event;

beforeEach(function () {
    Event::fake();
});

function suggestingRetro(RetroPhase $phase = RetroPhase::Discussing, array $attributes = []): array
{
    $retro = Retro::factory()->inPhase($phase)->withGuestAccess()->create($attributes);
    $theme = RetroTheme::factory()->create(['retro_id' => $retro->id, 'name' => 'Release pain']);
    $suggestion = SuggestedAction::factory()->create(['retro_id' => $retro->id, 'theme_id' => $theme->id, 'content' => 'Automate releases']);

    return [$retro, $theme, $suggestion];
}

function workspaceAdminParticipant(Retro $retro): array
{
    $user = User::factory()->create();
    $retro->team->workspace->members()->attach($user, ['role' => WorkspaceRole::Admin->value]);

    return [$user, Participant::factory()->create(['retro_id' => $retro->id, 'user_id' => $user->id])];
}

it('promotes a suggestion into an action item with its wording and theme', function () {
    [$retro, $theme, $suggestion] = suggestingRetro();
    [$user, $participant] = retroMember($retro);

    $response = $this->actingAs($user)
        ->postJson(route('retros.suggested-actions.promotion.store', [$retro, $suggestion]))
        ->assertOk()
        ->assertJsonPath('suggestedAction.status', 'promoted')
        ->assertJsonPath('actionItem.content', 'Automate releases')
        ->assertJsonPath('actionItem.themeId', $theme->id)
        ->assertJsonPath('actionItem.themeName', 'Release pain')
        ->assertJsonPath('actionItem.assignee', null);

    $suggestion->refresh();

    expect($suggestion->status)->toBe(SuggestedActionStatus::Promoted)
        ->and($suggestion->action_item_id)->toBe($response->json('actionItem.id'))
        ->and($suggestion->handled_by_participant_id)->toBe($participant->id)
        ->and($suggestion->handled_at)->not->toBeNull()
        ->and(ActionItem::find($suggestion->action_item_id)->created_by_participant_id)->toBe($participant->id);
    Event::assertDispatched(ActionItemSaved::class);
    Event::assertDispatched(InsightsChanged::class);
});

it('keeps the theme name after the summary is removed', function () {
    configureLlm();
    [$retro, , $suggestion] = suggestingRetro(RetroPhase::Completed);
    [$user] = retroFacilitator($retro);

    $itemId = $this->actingAs($user)->postJson(route('retros.suggested-actions.promotion.store', [$retro, $suggestion]))->json('actionItem.id');
    $this->actingAs($user)->deleteJson(route('retros.summary.destroy', $retro))->assertNoContent();

    expect(ActionItem::find($itemId)->only(['theme_id', 'theme_name']))->toBe(['theme_id' => null, 'theme_name' => 'Release pain']);
});

it('stores no theme for a suggestion without one', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Discussing)->create();
    $suggestion = SuggestedAction::factory()->create(['retro_id' => $retro->id]);
    [$user] = retroMember($retro);

    $this->actingAs($user)->postJson(route('retros.suggested-actions.promotion.store', [$retro, $suggestion]))
        ->assertJsonPath('actionItem.themeId', null)
        ->assertJsonPath('actionItem.themeName', null);
});

it('rejects a suggestion and keeps the row', function () {
    [$retro, , $suggestion] = suggestingRetro();
    [$user, $participant] = retroMember($retro);

    $this->actingAs($user)->deleteJson(route('retros.suggested-actions.destroy', [$retro, $suggestion]))
        ->assertOk()
        ->assertJsonPath('suggestedAction.status', 'rejected');

    expect($suggestion->fresh()->only(['status', 'handled_by_participant_id']))->toBe([
        'status' => SuggestedActionStatus::Rejected,
        'handled_by_participant_id' => $participant->id,
    ]);
    Event::assertDispatched(InsightsChanged::class);
});

it('promotes a suggestion only once', function () {
    [$retro, , $suggestion] = suggestingRetro();
    [$user] = retroMember($retro);

    $this->actingAs($user)->postJson(route('retros.suggested-actions.promotion.store', [$retro, $suggestion]))->assertOk();

    $this->actingAs($user)->postJson(route('retros.suggested-actions.promotion.store', [$retro, $suggestion]))
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['suggestion' => 'This suggestion was already handled.']);
    $this->actingAs($user)->deleteJson(route('retros.suggested-actions.destroy', [$retro, $suggestion]))->assertUnprocessable();

    expect(ActionItem::count())->toBe(1);
});

it('lets every participant handle suggestions while discussing unless locked', function () {
    [$retro, , $suggestion] = suggestingRetro();
    $guest = Participant::factory()->guest()->create(['retro_id' => $retro->id]);

    $this->withCookies(retroGuestCookie($guest))->withCredentials()
        ->postJson(route('retros.suggested-actions.promotion.store', [$retro, $suggestion]))
        ->assertOk();

    [$locked, , $other] = suggestingRetro(RetroPhase::Discussing, ['is_locked' => true]);
    [$member] = retroMember($locked);

    $this->actingAs($member)->postJson(route('retros.suggested-actions.promotion.store', [$locked, $other]))->assertStatus(423);
});

it('keeps completed suggestions to the facilitator and workspace managers', function () {
    [$retro, , $suggestion] = suggestingRetro(RetroPhase::Completed, ['is_locked' => true]);
    [$member] = retroMember($retro);
    $guest = Participant::factory()->guest()->create(['retro_id' => $retro->id]);
    [$admin] = workspaceAdminParticipant($retro);
    $second = SuggestedAction::factory()->create(['retro_id' => $retro->id]);
    [$facilitator] = retroFacilitator($retro);

    $this->actingAs($member)->postJson(route('retros.suggested-actions.promotion.store', [$retro, $suggestion]))->assertForbidden();
    $this->withCookies(retroGuestCookie($guest))->withCredentials()
        ->deleteJson(route('retros.suggested-actions.destroy', [$retro, $suggestion]))->assertForbidden();

    $this->actingAs($admin)->postJson(route('retros.suggested-actions.promotion.store', [$retro, $suggestion]))->assertOk();
    $this->actingAs($facilitator)->deleteJson(route('retros.suggested-actions.destroy', [$retro, $second]))->assertOk();

    Event::assertNotDispatched(ActionItemSaved::class);
});

it('refuses suggestions in other phases and from other retros', function () {
    [$retro, , $suggestion] = suggestingRetro(RetroPhase::Voting);
    [$user] = retroFacilitator($retro);
    [, , $foreign] = suggestingRetro();

    $this->actingAs($user)->postJson(route('retros.suggested-actions.promotion.store', [$retro, $suggestion]))->assertForbidden();

    $retro->update(['phase' => RetroPhase::Discussing]);

    $this->actingAs($user)->postJson(route('retros.suggested-actions.promotion.store', [$retro, $foreign]))->assertNotFound();
});

it('shows insights from discussing on, the same for every viewer', function () {
    [$retro, $theme, $suggestion] = suggestingRetro(RetroPhase::Voting);
    $card = Card::factory()->create(['retro_id' => $retro->id]);
    $card->forceFill(['sentiment' => CardSentiment::Negative, 'category' => 'Tooling'])->save();
    $theme->cards()->attach($card);
    [, $first] = retroMember($retro);
    [, $second] = retroMember($retro);

    expect(app(BuildBoardSnapshot::class)->handle($retro->fresh(), $first)['insights'])->toBeNull();

    $retro->update(['phase' => RetroPhase::Discussing]);
    $snapshots = [app(BuildBoardSnapshot::class)->handle($retro->fresh(), $first), app(BuildBoardSnapshot::class)->handle($retro->fresh(), $second)];

    expect($snapshots[0]['insights'])->toBe([
        'themes' => [['id' => $theme->id, 'name' => 'Release pain', 'cardIds' => [$card->id]]],
        'suggestedActions' => [['id' => $suggestion->id, 'content' => 'Automate releases', 'themeId' => $theme->id, 'status' => 'pending', 'actionItemId' => null]],
    ])
        ->and($snapshots[1]['insights'])->toBe($snapshots[0]['insights'])
        ->and(collect($snapshots[0]['cards'])->firstWhere('id', $card->id))->toMatchArray(['sentiment' => 'negative', 'category' => 'Tooling'])
        ->and(collect($snapshots[1]['cards'])->firstWhere('id', $card->id))->toMatchArray(['sentiment' => 'negative', 'category' => 'Tooling'])
        ->and($snapshots[0]['viewer']['canHandleSuggestions'])->toBeTrue();
});

it('never sends card insights of hidden cards or in card broadcasts', function () {
    $retro = Retro::factory()->create();
    $card = Card::factory()->create(['retro_id' => $retro->id]);
    $card->forceFill(['sentiment' => CardSentiment::Positive, 'category' => 'Tooling'])->save();
    [, $viewer] = retroMember($retro);

    expect(collect(app(BuildBoardSnapshot::class)->handle($retro->fresh(), $viewer)['cards'])->firstWhere('id', $card->id))
        ->toMatchArray(['sentiment' => null, 'category' => null])
        ->and(app(PresentCard::class)->handle($card->fresh(), $retro, null))->not->toHaveKeys(['sentiment', 'category']);
});

it('tells members of a completed retro they cannot handle suggestions', function () {
    [$retro] = suggestingRetro(RetroPhase::Completed);
    [, $member] = retroMember($retro);

    expect(app(BuildBoardSnapshot::class)->handle($retro->fresh(), $member)['viewer']['canHandleSuggestions'])->toBeFalse();
});

it('exposes the summary state in the results', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Completed)->create([
        'summary' => 'Text', 'summary_status' => SummaryStatus::Pending, 'summary_requested_at' => now()->subMinutes(20),
    ]);
    [, $viewer] = retroMember($retro);

    expect(app(BuildBoardSnapshot::class)->handle($retro->fresh(), $viewer)['results']['summary'])->toBeNull();

    configureLlm();

    expect(app(BuildBoardSnapshot::class)->handle($retro->fresh(), $viewer)['results']['summary'])
        ->toMatchArray(['text' => 'Text', 'status' => 'failed', 'provider' => 'Anthropic']);
});

it('stores no insights when the summary was removed during the run', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Completed)->create(['summary_status' => null]);
    $card = Card::factory()->create(['retro_id' => $retro->id]);

    app(StoreRetroInsights::class)->handle($retro, new SummaryOutput('Text', [['name' => 'Theme', 'cardIds' => [$card->id]]], [['content' => 'Do it', 'theme' => null]], []));

    expect($retro->fresh()->summary)->toBeNull()
        ->and($retro->themes()->count())->toBe(0)
        ->and($retro->suggestedActions()->count())->toBe(0);
});
