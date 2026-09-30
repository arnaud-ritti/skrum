<?php

use App\Enums\McpScope;
use App\Enums\RetroPhase;
use App\Events\Retros\CardDeleted;
use App\Events\Retros\CardUpdated;
use App\Mcp\Tools\Retro\DeleteOwnMessage;
use App\Mcp\Tools\Retro\UpdateMessage;
use App\Models\Card;
use App\Models\Participant;
use App\Models\Retro;
use App\Models\Team;
use Illuminate\Support\Facades\Event;

beforeEach(function () {
    Event::fake();
});

it('updates the user\'s own message and broadcasts it', function () {
    $retro = Retro::factory()->create();
    [$user, $participant] = retroMember($retro);
    $card = Card::factory()->create(['retro_id' => $retro->id, 'participant_id' => $participant->id, 'content' => 'Old', 'gif_id' => null]);

    $message = mcpStructured(mcpWriter($user)->tool(UpdateMessage::class, ['message_id' => $card->id, 'content' => 'New'])->assertOk());

    expect($message['id'])->toBe($card->id)
        ->and($message['content'])->toBe('New')
        ->and($message['isMine'])->toBeTrue()
        ->and($card->fresh()->content)->toBe('New');

    Event::assertDispatched(CardUpdated::class);
});

it('keeps the GIF of an updated message', function () {
    $retro = Retro::factory()->create(['gifs_enabled' => true]);
    [$user, $participant] = retroMember($retro);
    $card = Card::factory()->create(['retro_id' => $retro->id, 'participant_id' => $participant->id, 'gif_id' => 'abc']);

    mcpWriter($user)->tool(UpdateMessage::class, ['message_id' => $card->id, 'content' => 'Caption'])->assertOk();

    expect($card->fresh()->gif_id)->toBe('abc');
});

it('reports another participant\'s message as not found', function () {
    $retro = Retro::factory()->create();
    [$user] = retroMember($retro);
    $card = Card::factory()->create(['retro_id' => $retro->id]);

    mcpWriter($user)->tool(UpdateMessage::class, ['message_id' => $card->id, 'content' => 'Mine'])->assertHasErrors(['Not found.']);
    actingAsMcp($user, [McpScope::Read, McpScope::Delete])->tool(DeleteOwnMessage::class, ['message_id' => $card->id])->assertHasErrors(['Not found.']);

    expect(Card::query()->whereKey($card->id)->exists())->toBeTrue();
});

it('reports messages as not found for users without a participant and never creates one', function () {
    $retro = Retro::factory()->create();
    $user = teamMember($retro->team);
    $card = Card::factory()->create(['retro_id' => $retro->id]);

    mcpWriter($user)->tool(UpdateMessage::class, ['message_id' => $card->id, 'content' => 'Mine'])->assertHasErrors(['Not found.']);

    expect(Participant::query()->where('user_id', $user->id)->exists())->toBeFalse();
});

it('reports messages of invisible boards as not found', function () {
    $card = Card::factory()->create();

    mcpWriter(teamMember(Team::factory()->create()))->tool(UpdateMessage::class, ['message_id' => $card->id, 'content' => 'X'])->assertHasErrors(['Not found.']);
});

it('refuses message edits in phases the board refuses', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Voting)->create();
    [$user, $participant] = retroMember($retro);
    $card = Card::factory()->create(['retro_id' => $retro->id, 'participant_id' => $participant->id]);

    mcpWriter($user)->tool(UpdateMessage::class, ['message_id' => $card->id, 'content' => 'Late'])
        ->assertHasErrors(['This action is not available in the current phase.']);
});

it('deletes the user\'s own message', function () {
    $retro = Retro::factory()->create();
    [$user, $participant] = retroMember($retro);
    $card = Card::factory()->create(['retro_id' => $retro->id, 'participant_id' => $participant->id]);

    $result = mcpStructured(actingAsMcp($user, [McpScope::Read, McpScope::Delete])->tool(DeleteOwnMessage::class, ['message_id' => $card->id])->assertOk());

    expect($result)->toBe(['deleted' => true])
        ->and(Card::query()->whereKey($card->id)->exists())->toBeFalse();

    Event::assertDispatched(CardDeleted::class);
});

it('keeps update and delete behind their own scopes', function () {
    $user = teamMember(Team::factory()->create());

    expect(mcpToolNames(mcpWriter($user)))->toContain('retro.board.messages.update')->not->toContain('retro.board.messages.delete_own')
        ->and(mcpToolNames(actingAsMcp($user, [McpScope::Read, McpScope::Delete])))->toContain('retro.board.messages.delete_own')->not->toContain('retro.board.messages.update');
});

it('refuses deleting an own message in a phase that forbids it', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Voting)->create();
    [$user, $participant] = retroMember($retro);
    $card = Card::factory()->create(['retro_id' => $retro->id, 'participant_id' => $participant->id]);

    actingAsMcp($user, [McpScope::Read, McpScope::Delete])->tool(DeleteOwnMessage::class, ['message_id' => $card->id])
        ->assertHasErrors(['This action is not available in the current phase.']);

    expect(Card::query()->whereKey($card->id)->exists())->toBeTrue();
});

it('refuses updating and deleting an own message on a locked board', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Writing)->create(['is_locked' => true]);
    [$user, $participant] = retroMember($retro);
    $card = Card::factory()->create(['retro_id' => $retro->id, 'participant_id' => $participant->id, 'content' => 'Kept']);

    mcpWriter($user)->tool(UpdateMessage::class, ['message_id' => $card->id, 'content' => 'Changed'])
        ->assertHasErrors(['The board is closed for editing.']);
    actingAsMcp($user, [McpScope::Read, McpScope::Delete])->tool(DeleteOwnMessage::class, ['message_id' => $card->id])
        ->assertHasErrors(['The board is closed for editing.']);

    expect($card->fresh()->content)->toBe('Kept');
});

it('rejects message content over 1000 characters', function () {
    $retro = Retro::factory()->create();
    [$user, $participant] = retroMember($retro);
    $card = Card::factory()->create(['retro_id' => $retro->id, 'participant_id' => $participant->id, 'content' => 'Short']);

    mcpWriter($user)->tool(UpdateMessage::class, ['message_id' => $card->id, 'content' => str_repeat('a', 1001)])->assertHasErrors();

    expect($card->fresh()->content)->toBe('Short');
});
