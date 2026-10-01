<?php

use App\Actions\Retros\PresentActionItem;
use App\Enums\RetroPhase;
use App\Events\Retros\ActionItemCommentsChanged;
use App\Models\ActionItem;
use App\Models\ActionItemComment;
use App\Models\Participant;
use App\Models\Retro;
use Illuminate\Support\Facades\Event;

beforeEach(function () {
    Event::fake();
});

/**
 * @return array{0: Retro, 1: ActionItem}
 */
function commentedBoardItem(RetroPhase $phase = RetroPhase::Discussing, array $attributes = []): array
{
    $retro = Retro::factory()->inPhase($phase)->withGuestAccess()->create($attributes);

    return [$retro, ActionItem::factory()->create(['retro_id' => $retro->id])];
}

it('comments on board items and names authors on anonymous retros', function () {
    [$retro, $item] = commentedBoardItem(attributes: ['is_anonymous' => true]);
    [$user, $participant] = retroMember($retro);

    $this->actingAs($user)
        ->postJson(route('retros.action-items.comments.store', [$retro, $item]), ['content' => 'I can take it'])
        ->assertCreated()
        ->assertJsonPath('comment.content', 'I can take it')
        ->assertJsonPath('comment.author', ['name' => $user->name, 'avatarUrl' => $participant->avatarUrl()])
        ->assertJsonPath('comment.isMine', true);

    $this->actingAs($user)
        ->postJson(route('retros.action-items.comments.store', [$retro, $item]), ['content' => 'Done by Friday'])
        ->assertCreated();

    $this->actingAs($user)
        ->getJson(route('retros.action-items.comments.index', [$retro, $item]))
        ->assertOk()
        ->assertJsonPath('comments.0.content', 'I can take it')
        ->assertJsonPath('comments.1.content', 'Done by Friday')
        ->assertJsonPath('comments.1.author.name', $user->name);

    expect(ActionItemComment::query()->pluck('author_participant_id')->unique()->all())->toBe([$participant->id])
        ->and(resolve(PresentActionItem::class)->handle($item->fresh())['commentCount'])->toBe(2);
    Event::assertDispatched(fn (ActionItemCommentsChanged $event) => $event->retroId === $retro->id
        && $event->broadcastWith() === ['actionItemId' => $item->id, 'commentCount' => 2]);
});

it('lets guests comment on their own board', function () {
    [$retro, $item] = commentedBoardItem();
    $guest = Participant::factory()->guest()->create(['retro_id' => $retro->id, 'guest_name' => 'Robin']);

    $this->withCookies(retroGuestCookie($guest))->withCredentials()
        ->postJson(route('retros.action-items.comments.store', [$retro, $item]), ['content' => 'Count me in'])
        ->assertCreated()
        ->assertJsonPath('comment.author.name', 'Robin');
});

it('validates the comment length', function (string $content) {
    [$retro, $item] = commentedBoardItem();
    [$user] = retroMember($retro);

    $this->actingAs($user)
        ->postJson(route('retros.action-items.comments.store', [$retro, $item]), ['content' => $content])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('content');
})->with(['empty' => '', 'too long' => str_repeat('a', 501)]);

it('lets only the author edit a comment', function () {
    [$retro, $item] = commentedBoardItem();
    [$authorUser, $author] = retroMember($retro);
    [$otherUser] = retroMember($retro);
    $comment = ActionItemComment::factory()->byParticipant($author)->create(['action_item_id' => $item->id]);

    $this->actingAs($otherUser)
        ->patchJson(route('retros.action-items.comments.update', [$retro, $comment]), ['content' => 'Hijacked'])
        ->assertForbidden();
    $this->actingAs($authorUser)
        ->patchJson(route('retros.action-items.comments.update', [$retro, $comment]), ['content' => 'Updated'])
        ->assertOk()
        ->assertJsonPath('comment.content', 'Updated');
});

it('lets the author and managers delete a comment', function () {
    [$retro, $item] = commentedBoardItem();
    [, $author] = retroMember($retro);
    [$otherUser] = retroMember($retro);
    [$facilitatorUser] = retroFacilitator($retro);
    $comment = ActionItemComment::factory()->byParticipant($author)->create(['action_item_id' => $item->id]);

    $this->actingAs($otherUser)
        ->deleteJson(route('retros.action-items.comments.destroy', [$retro, $comment]))
        ->assertForbidden();
    $this->actingAs($facilitatorUser)
        ->deleteJson(route('retros.action-items.comments.destroy', [$retro, $comment]))
        ->assertNoContent();

    expect(ActionItemComment::count())->toBe(0);
});

it('reads comments in every phase but writes them only while discussing', function () {
    [$retro, $item] = commentedBoardItem(RetroPhase::Completed);
    [$user] = retroMember($retro);
    ActionItemComment::factory()->create(['action_item_id' => $item->id]);

    $this->actingAs($user)->getJson(route('retros.action-items.comments.index', [$retro, $item]))->assertOk()->assertJsonCount(1, 'comments');
    $this->actingAs($user)->postJson(route('retros.action-items.comments.store', [$retro, $item]), ['content' => 'Late'])->assertForbidden();
});

it('refuses comments while the board is locked', function () {
    [$retro, $item] = commentedBoardItem(attributes: ['is_locked' => true]);
    [$user] = retroMember($retro);

    $this->actingAs($user)
        ->postJson(route('retros.action-items.comments.store', [$retro, $item]), ['content' => 'Locked'])
        ->assertStatus(423);
});

it('returns 404 for comments of other retros and deletes comments with their item', function () {
    [$retro, $item] = commentedBoardItem();
    [$user] = retroMember($retro);
    $foreign = ActionItemComment::factory()->create();
    ActionItemComment::factory()->count(2)->create(['action_item_id' => $item->id]);

    $this->actingAs($user)
        ->patchJson(route('retros.action-items.comments.update', [$retro, $foreign]), ['content' => 'x'])
        ->assertNotFound();

    $item->delete();

    expect(ActionItemComment::count())->toBe(1);
});
