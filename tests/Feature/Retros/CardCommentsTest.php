<?php

use App\Enums\RetroPhase;
use App\Events\Retros\CommentCreated;
use App\Events\Retros\CommentDeleted;
use App\Events\Retros\CommentNotification;
use App\Events\Retros\CommentUpdated;
use App\Events\Retros\OwnCommentSaved;
use App\Models\Card;
use App\Models\CardComment;
use App\Models\Retro;
use Illuminate\Support\Facades\Event;

beforeEach(function () {
    Event::fake();
});

function commentingRetro(RetroPhase $phase = RetroPhase::Grouping, array $attributes = []): array
{
    $retro = Retro::factory()->inPhase($phase)->create($attributes);
    [$user, $participant] = retroMember($retro);
    $card = Card::factory()->create(['retro_id' => $retro->id]);

    return [$retro, $user, $participant, $card];
}

it('comments on a card and sends the author their comment on their private channel', function () {
    [$retro, $user, $participant, $card] = commentingRetro();

    $response = $this->actingAs($user)
        ->postJson(route('retros.cards.comments.store', [$retro, $card]), ['content' => ' Agreed '])
        ->assertCreated()
        ->assertJsonPath('comment.content', 'Agreed')
        ->assertJsonPath('comment.isMine', true)
        ->assertJsonPath('comment.author.id', $participant->id);

    Event::assertDispatched(fn (CommentCreated $event) => $event->comment['id'] === $response->json('comment.id')
        && $event->comment['isMine'] === false);
    Event::assertDispatched(fn (OwnCommentSaved $event) => $event->participantId === $participant->id
        && $event->comment['isMine'] === true
        && $event->broadcastOn()->name === "private-participant.{$participant->id}");
});

it('validates comment content', function (string $content) {
    [$retro, $user, , $card] = commentingRetro();

    $this->actingAs($user)->postJson(route('retros.cards.comments.store', [$retro, $card]), ['content' => $content])->assertUnprocessable();
})->with(['empty' => '', 'too long' => str_repeat('a', 501)]);

it('attaches a reply to a reply to the top-level comment', function () {
    [$retro, $user, , $card] = commentingRetro();
    $parent = CardComment::factory()->create(['retro_id' => $retro->id, 'card_id' => $card->id]);
    $reply = CardComment::factory()->create(['retro_id' => $retro->id, 'card_id' => $card->id, 'parent_comment_id' => $parent->id]);

    $this->actingAs($user)
        ->postJson(route('retros.cards.comments.store', [$retro, $card]), ['content' => 'Me too', 'parentCommentId' => $reply->id])
        ->assertCreated()
        ->assertJsonPath('comment.parentCommentId', $parent->id);
});

it('refuses a parent comment from another card', function () {
    [$retro, $user, , $card] = commentingRetro();
    $otherComment = CardComment::factory()->create(['retro_id' => $retro->id]);

    $this->actingAs($user)
        ->postJson(route('retros.cards.comments.store', [$retro, $card]), ['content' => 'x', 'parentCommentId' => $otherComment->id])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['parentCommentId' => 'The reply must belong to a comment on the same card.']);
});

it('lets only the author edit and the author or facilitator delete', function () {
    [$retro, $user, $participant, $card] = commentingRetro();
    [$other] = retroMember($retro);
    [$facilitator] = retroFacilitator($retro);
    $comment = CardComment::factory()->create(['retro_id' => $retro->id, 'card_id' => $card->id, 'participant_id' => $participant->id]);
    $othersComment = CardComment::factory()->create(['retro_id' => $retro->id, 'card_id' => $card->id]);

    $this->actingAs($other)->patchJson(route('retros.comments.update', [$retro, $comment]), ['content' => 'Hijack'])->assertForbidden();
    $this->actingAs($user)->patchJson(route('retros.comments.update', [$retro, $comment]), ['content' => 'Edited'])
        ->assertOk()
        ->assertJsonPath('comment.content', 'Edited');
    Event::assertDispatched(CommentUpdated::class);

    $this->actingAs($other)->deleteJson(route('retros.comments.destroy', [$retro, $comment]))->assertForbidden();
    $this->actingAs($user)->deleteJson(route('retros.comments.destroy', [$retro, $comment]))->assertNoContent();
    $this->actingAs($facilitator)->deleteJson(route('retros.comments.destroy', [$retro, $othersComment]))->assertNoContent();

    expect(CardComment::count())->toBe(0);
    Event::assertDispatched(fn (CommentDeleted $event) => $event->commentId === $comment->id && $event->soft === false);
});

it('soft deletes a parent with replies and removes it with its last reply', function () {
    [$retro, $user, $participant, $card] = commentingRetro();
    $parent = CardComment::factory()->create(['retro_id' => $retro->id, 'card_id' => $card->id, 'participant_id' => $participant->id]);
    $reply = CardComment::factory()->create(['retro_id' => $retro->id, 'card_id' => $card->id, 'parent_comment_id' => $parent->id, 'participant_id' => $participant->id]);

    $this->actingAs($user)->deleteJson(route('retros.comments.destroy', [$retro, $parent]))->assertNoContent();

    expect($parent->fresh())->content->toBeNull()->deleted_at->not->toBeNull();
    Event::assertDispatched(fn (CommentDeleted $event) => $event->commentId === $parent->id && $event->soft);

    $this->actingAs($user)->patchJson(route('retros.comments.update', [$retro, $parent]), ['content' => 'Back'])->assertNotFound();

    $this->actingAs($user)->deleteJson(route('retros.comments.destroy', [$retro, $reply]))->assertNoContent();

    expect(CardComment::count())->toBe(0);
    Event::assertDispatched(fn (CommentDeleted $event) => $event->commentId === $parent->id && $event->soft === false);
});

it('refuses comments before grouping, once completed and while locked', function (RetroPhase $phase, array $attributes, int $status) {
    [$retro, $user, , $card] = commentingRetro($phase, $attributes);

    $this->actingAs($user)->postJson(route('retros.cards.comments.store', [$retro, $card]), ['content' => 'x'])->assertStatus($status);
})->with([
    'writing' => [RetroPhase::Writing, [], 403],
    'completed' => [RetroPhase::Completed, [], 403],
    'locked' => [RetroPhase::Discussing, ['is_locked' => true], 423],
]);

it('hides comment authors from others on anonymous retros', function () {
    [$retro, $user, , $card] = commentingRetro(RetroPhase::Grouping, ['is_anonymous' => true]);

    $this->actingAs($user)->postJson(route('retros.cards.comments.store', [$retro, $card]), ['content' => 'Quiet'])
        ->assertJsonPath('comment.author.name', $user->name);

    Event::assertDispatched(fn (CommentCreated $event) => $event->comment['author'] === null);
});

it('notifies the card author and the thread participants but not the commenter', function () {
    [$retro, $user, $participant, $card] = commentingRetro();
    [, $earlier] = retroMember($retro);
    $thread = CardComment::factory()->create(['retro_id' => $retro->id, 'card_id' => $card->id, 'participant_id' => $earlier->id]);

    $this->actingAs($user)->postJson(route('retros.cards.comments.store', [$retro, $card]), ['content' => 'Replying here', 'parentCommentId' => $thread->id])
        ->assertCreated();

    $recipients = collect(Event::dispatched(CommentNotification::class))->map(fn (array $dispatch) => $dispatch[0]->participantId)->sort()->values()->all();

    expect($recipients)->toBe(collect([$card->participant_id, $earlier->id])->sort()->values()->all());
    Event::assertDispatched(fn (CommentNotification $event) => $event->broadcastWith()['threadId'] === $thread->id
        && $event->broadcastWith()['authorName'] === $user->name
        && $event->broadcastOn()->name === "private-participant.{$event->participantId}");
});

it('notifies without naming anyone on anonymous retros', function () {
    [$retro, $user, , $card] = commentingRetro(RetroPhase::Grouping, ['is_anonymous' => true]);

    $this->actingAs($user)->postJson(route('retros.cards.comments.store', [$retro, $card]), ['content' => 'Hi'])->assertCreated();

    Event::assertDispatched(fn (CommentNotification $event) => ! array_key_exists('authorName', $event->broadcastWith()));
});

it('does not notify the commenter about their own card', function () {
    [$retro, $user, $participant] = commentingRetro();
    $own = Card::factory()->create(['retro_id' => $retro->id, 'participant_id' => $participant->id]);

    $this->actingAs($user)->postJson(route('retros.cards.comments.store', [$retro, $own]), ['content' => 'Note to self'])->assertCreated();

    Event::assertNotDispatched(CommentNotification::class);
});

it('keeps a long comment notification excerpt within 80 characters', function () {
    [$retro, $user, , $card] = commentingRetro();

    $this->actingAs($user)->postJson(route('retros.cards.comments.store', [$retro, $card]), ['content' => str_repeat('a', 500)])->assertCreated();

    Event::assertDispatched(fn (CommentNotification $event) => mb_strlen($event->broadcastWith()['excerpt']) <= 80
        && str_ends_with($event->broadcastWith()['excerpt'], '…'));
});

it('returns 404 for cards and comments of another retro', function () {
    [$retro, $user] = commentingRetro();
    $foreignCard = Card::factory()->create();
    $foreignComment = CardComment::factory()->create();

    $this->actingAs($user)->postJson(route('retros.cards.comments.store', [$retro, $foreignCard]), ['content' => 'x'])->assertNotFound();
    $this->actingAs($user)->deleteJson(route('retros.comments.destroy', [$retro, $foreignComment]))->assertNotFound();
});
