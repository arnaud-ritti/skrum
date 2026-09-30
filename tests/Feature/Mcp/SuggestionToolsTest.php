<?php

use App\Enums\RetroPhase;
use App\Enums\SuggestedActionStatus;
use App\Events\Retros\InsightsChanged;
use App\Mcp\Tools\Retro\PromoteSuggestion;
use App\Mcp\Tools\Retro\RejectSuggestion;
use App\Models\ActionItem;
use App\Models\Participant;
use App\Models\Retro;
use App\Models\RetroTheme;
use App\Models\SuggestedAction;
use App\Models\Team;
use Illuminate\Support\Facades\Event;

beforeEach(function () {
    Event::fake();
    configureLlm();
});

it('hides suggestion tools without an LLM provider', function () {
    config(['services.llm.key' => null]);
    $user = teamMember(Team::factory()->create());

    expect(mcpToolNames(mcpWriter($user)))->not->toContain('retro.board.suggested_actions.promote')->not->toContain('retro.board.suggested_actions.reject');
});

it('offers suggestion tools to write tokens when a provider is configured', function () {
    $user = teamMember(Team::factory()->create());

    expect(mcpToolNames(mcpWriter($user)))->toContain('retro.board.suggested_actions.promote', 'retro.board.suggested_actions.reject')
        ->and(mcpToolNames(actingAsMcp($user)))->not->toContain('retro.board.suggested_actions.promote')->not->toContain('retro.board.suggested_actions.reject');
});

it('promotes a suggestion while discussing, keeping its wording and theme', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Discussing)->create();
    $user = teamMember($retro->team);
    $theme = RetroTheme::factory()->create(['retro_id' => $retro->id]);
    $suggestion = SuggestedAction::factory()->create(['retro_id' => $retro->id, 'theme_id' => $theme->id, 'content' => 'Timebox standups']);

    $result = mcpStructured(mcpWriter($user)->tool(PromoteSuggestion::class, ['board_id' => $retro->id, 'suggested_action_id' => $suggestion->id])->assertOk());

    $item = ActionItem::query()->sole();
    $participant = Participant::query()->where('retro_id', $retro->id)->where('user_id', $user->id)->sole();

    expect($item->content)->toBe('Timebox standups')
        ->and($item->theme_id)->toBe($theme->id)
        ->and($item->created_by_participant_id)->toBe($participant->id)
        ->and($suggestion->fresh()->status)->toBe(SuggestedActionStatus::Promoted)
        ->and($suggestion->fresh()->action_item_id)->toBe($item->id)
        ->and($result['suggestedAction']['status'])->toBe('promoted')
        ->and($result['actionItem']['id'])->toBe($item->id);

    Event::assertDispatched(InsightsChanged::class);
});

it('refuses a suggestion that was already handled', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Discussing)->create();
    $user = teamMember($retro->team);
    $suggestion = SuggestedAction::factory()->create(['retro_id' => $retro->id]);

    mcpWriter($user)->tool(PromoteSuggestion::class, ['board_id' => $retro->id, 'suggested_action_id' => $suggestion->id])->assertOk();
    mcpWriter($user)->tool(PromoteSuggestion::class, ['board_id' => $retro->id, 'suggested_action_id' => $suggestion->id])
        ->assertHasErrors(['This suggestion was already handled.']);
    mcpWriter($user)->tool(RejectSuggestion::class, ['board_id' => $retro->id, 'suggested_action_id' => $suggestion->id])
        ->assertHasErrors(['This suggestion was already handled.']);

    expect(ActionItem::query()->count())->toBe(1);
});

it('refuses suggestions before Discussing without creating a participant', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Voting)->create();
    $user = teamMember($retro->team);
    $suggestion = SuggestedAction::factory()->create(['retro_id' => $retro->id]);

    mcpWriter($user)->tool(PromoteSuggestion::class, ['board_id' => $retro->id, 'suggested_action_id' => $suggestion->id])
        ->assertHasErrors(['This action is not available in the current phase.']);

    expect(Participant::query()->where('user_id', $user->id)->exists())->toBeFalse();
});

it('refuses suggestions on a locked discussing board', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Discussing)->create(['is_locked' => true]);
    $suggestion = SuggestedAction::factory()->create(['retro_id' => $retro->id]);

    mcpWriter(teamMember($retro->team))->tool(RejectSuggestion::class, ['board_id' => $retro->id, 'suggested_action_id' => $suggestion->id])
        ->assertHasErrors(['The board is closed for editing.']);
});

it('lets only the facilitator or a workspace admin handle suggestions once completed', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Completed)->create(['is_locked' => true]);
    $suggestion = SuggestedAction::factory()->create(['retro_id' => $retro->id]);

    mcpWriter(teamMember($retro->team))->tool(RejectSuggestion::class, ['board_id' => $retro->id, 'suggested_action_id' => $suggestion->id])
        ->assertHasErrors(['Only the facilitator can do this.']);

    mcpWriter(workspaceManager($retro->team->workspace))->tool(RejectSuggestion::class, ['board_id' => $retro->id, 'suggested_action_id' => $suggestion->id])
        ->assertOk();

    expect($suggestion->fresh()->status)->toBe(SuggestedActionStatus::Rejected);
});

it('reports suggestions of another board or team as not found', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Discussing)->create();
    $otherRetro = Retro::factory()->inPhase(RetroPhase::Discussing)->create(['team_id' => $retro->team_id]);
    $user = teamMember($retro->team);
    $foreign = SuggestedAction::factory()->create(['retro_id' => $otherRetro->id]);
    $invisible = SuggestedAction::factory()->create();

    mcpWriter($user)->tool(PromoteSuggestion::class, ['board_id' => $retro->id, 'suggested_action_id' => $foreign->id])->assertHasErrors(['Not found.']);
    mcpWriter($user)->tool(PromoteSuggestion::class, ['board_id' => $invisible->retro_id, 'suggested_action_id' => $invisible->id])->assertHasErrors(['Not found.']);
});

it('creates no participant when a suggestion call is refused', function (string $tool, RetroPhase $phase, array $attributes) {
    $retro = Retro::factory()->inPhase($phase)->create($attributes);
    $user = teamMember($retro->team);
    $suggestion = SuggestedAction::factory()->create(['retro_id' => $retro->id]);

    mcpWriter($user)->tool($tool, ['board_id' => $retro->id, 'suggested_action_id' => $suggestion->id])->assertHasErrors();

    expect(Participant::query()->where('retro_id', $retro->id)->exists())->toBeFalse()
        ->and($suggestion->fresh()->status)->toBe(SuggestedActionStatus::Pending);
})->with([
    'promote on a locked discussing board' => [PromoteSuggestion::class, RetroPhase::Discussing, ['is_locked' => true]],
    'reject on a locked discussing board' => [RejectSuggestion::class, RetroPhase::Discussing, ['is_locked' => true]],
    'promote by a plain member once completed' => [PromoteSuggestion::class, RetroPhase::Completed, []],
    'reject by a plain member once completed' => [RejectSuggestion::class, RetroPhase::Completed, []],
]);

it('lets the facilitator of a completed board promote a suggestion', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Completed)->create();
    [$user, $participant] = retroMember($retro);
    $retro->update(['facilitator_participant_id' => $participant->id]);
    $suggestion = SuggestedAction::factory()->create(['retro_id' => $retro->id, 'content' => 'Ship it']);

    $result = mcpStructured(mcpWriter($user)->tool(PromoteSuggestion::class, ['board_id' => $retro->id, 'suggested_action_id' => $suggestion->id])->assertOk());

    expect($result['suggestedAction']['status'])->toBe('promoted')
        ->and($result['actionItem']['content'])->toBe('Ship it');
});
