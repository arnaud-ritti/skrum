<?php

use App\Enums\RetroPhase;
use App\Events\Retros\CommentCreated;
use App\Events\Retros\CommentNotification;
use App\Events\Retros\OwnSurveyCommentSaved;
use App\Events\Retros\SurveyDiscussionChanged;
use App\Models\Retro;
use App\Models\Survey;
use App\Models\SurveyComment;
use App\Models\SurveyReaction;
use Illuminate\Support\Facades\Event;

beforeEach(function () {
    Event::fake();
});

function discussedSurvey(RetroPhase $phase = RetroPhase::Discussing, array $retroAttributes = [], array $surveyAttributes = []): array
{
    $retro = Retro::factory()->inPhase($phase)->create($retroAttributes);
    [$user, $participant] = retroMember($retro);
    $survey = Survey::factory()->withOptions()->create(['retro_id' => $retro->id, ...$surveyAttributes]);

    return [$retro, $user, $participant, $survey];
}

it('refuses reactions and comments until the viewer can see the results', function () {
    [$retro, $user, $participant, $survey] = discussedSurvey();

    $this->actingAs($user)->putJson(route('retros.surveys.reactions.update', [$retro, $survey]), ['emoji' => '👍'])
        ->assertForbidden()
        ->assertJsonPath('message', 'Answer the survey to join the discussion.');
    $this->actingAs($user)->postJson(route('retros.surveys.comments.store', [$retro, $survey]), ['content' => 'Hmm'])->assertForbidden();

    answerSurvey($survey, $participant, 0);

    $this->actingAs($user)->putJson(route('retros.surveys.reactions.update', [$retro, $survey]), ['emoji' => '👍'])->assertOk();
    $this->actingAs($user)->postJson(route('retros.surveys.comments.store', [$retro, $survey]), ['content' => 'Hmm'])->assertCreated();
});

it('opens the discussion of a closed survey to everyone', function () {
    [$retro, $user, , $survey] = discussedSurvey(RetroPhase::Discussing, [], ['is_closed' => true]);

    $this->actingAs($user)->postJson(route('retros.surveys.comments.store', [$retro, $survey]), ['content' => 'Late thought'])->assertCreated();
});

it('hides the discussion again after the viewer withdraws their answer', function () {
    [$retro, $user, , $survey] = discussedSurvey();
    SurveyComment::factory()->create(['retro_id' => $retro->id, 'survey_id' => $survey->id, 'content' => 'Visible after answering']);

    $this->actingAs($user)->putJson(route('retros.surveys.response.update', [$retro, $survey]), ['optionId' => $survey->options->first()->id])
        ->assertJsonPath('survey.comments.0.content', 'Visible after answering');
    $this->actingAs($user)->deleteJson(route('retros.surveys.response.destroy', [$retro, $survey]))
        ->assertJsonPath('survey.comments', [])
        ->assertJsonPath('survey.reactions', [])
        ->assertJsonPath('survey.commentCount', 1);
    $this->actingAs($user)->postJson(route('retros.surveys.comments.store', [$retro, $survey]), ['content' => 'Sneaky'])->assertForbidden();
});

it('toggles reactions idempotently and broadcasts only the survey and its comment count', function () {
    [$retro, $user, $participant, $survey] = discussedSurvey();
    answerSurvey($survey, $participant, 0);
    $route = route('retros.surveys.reactions.update', [$retro, $survey]);

    $this->actingAs($user)->putJson($route, ['emoji' => '🎉'])->assertOk();
    $this->actingAs($user)->putJson($route, ['emoji' => '🎉'])
        ->assertJsonPath('survey.reactions', [['emoji' => '🎉', 'count' => 1, 'mine' => true, 'names' => []]]);

    expect(SurveyReaction::count())->toBe(1);
    Event::assertDispatched(SurveyDiscussionChanged::class, fn (SurveyDiscussionChanged $event) => $event->broadcastAs() === 'survey.discussion.changed'
        && $event->broadcastWith() === ['surveyId' => $survey->id, 'commentCount' => 0]);

    $this->actingAs($user)->deleteJson(route('retros.surveys.reactions.destroy', [$retro, $survey]), ['emoji' => '🎉'])
        ->assertJsonPath('survey.reactions', []);
});

it('names reactions only when show who answered is on a named retro', function (bool $isAnonymous, array $names) {
    $retro = Retro::factory()->inPhase(RetroPhase::Voting)->create(['is_anonymous' => $isAnonymous]);
    [$user, $participant] = retroMember($retro);
    $survey = Survey::factory()->closed()->withOptions()->create(['retro_id' => $retro->id, 'show_voters' => true]);

    $this->actingAs($user)->putJson(route('retros.surveys.reactions.update', [$retro, $survey]), ['emoji' => '👍'])
        ->assertJsonPath('survey.reactions.0.names', $names === [] ? [] : [$user->name]);
})->with([
    'named retro' => [false, ['name']],
    'anonymous retro' => [true, []],
]);

it('refuses survey reactions once completed, while locked, when turned off, and with a non-emoji', function (RetroPhase $phase, array $attributes, array $body, int $status) {
    [$retro, $user, $participant, $survey] = discussedSurvey($phase, $attributes);
    answerSurvey($survey, $participant, 0);

    $this->actingAs($user)->putJson(route('retros.surveys.reactions.update', [$retro, $survey]), $body)->assertStatus($status);
})->with([
    'completed' => [RetroPhase::Completed, [], ['emoji' => '👍'], 403],
    'locked' => [RetroPhase::Grouping, ['is_locked' => true], ['emoji' => '👍'], 423],
    'turned off' => [RetroPhase::Voting, ['reactions_enabled' => false], ['emoji' => '👍'], 403],
    'not an emoji' => [RetroPhase::Writing, [], ['emoji' => 'lol'], 422],
]);

it('comments on a survey and sends the author their comment on their private channel only', function () {
    [$retro, $user, $participant, $survey] = discussedSurvey();
    answerSurvey($survey, $participant, 0);

    $response = $this->actingAs($user)->postJson(route('retros.surveys.comments.store', [$retro, $survey]), ['content' => ' Agreed '])
        ->assertCreated()
        ->assertJsonPath('comment.surveyId', $survey->id)
        ->assertJsonPath('comment.content', 'Agreed')
        ->assertJsonPath('comment.author.id', $participant->id);

    Event::assertNotDispatched(CommentCreated::class);
    Event::assertDispatched(SurveyDiscussionChanged::class, fn (SurveyDiscussionChanged $event) => $event->broadcastWith() === ['surveyId' => $survey->id, 'commentCount' => 1]);
    Event::assertDispatched(OwnSurveyCommentSaved::class, fn (OwnSurveyCommentSaved $event) => $event->comment['id'] === $response->json('comment.id')
        && $event->broadcastAs() === 'own-survey-comment.saved'
        && $event->broadcastOn()->name === "private-participant.{$participant->id}");
});

it('hides survey comment authors from others on anonymous retros', function () {
    [$retro, $user, $participant, $survey] = discussedSurvey(RetroPhase::Discussing, ['is_anonymous' => true], ['is_closed' => true]);
    [$otherUser] = retroMember($retro);

    $this->actingAs($user)->postJson(route('retros.surveys.comments.store', [$retro, $survey]), ['content' => 'Quiet'])->assertCreated();

    $this->actingAs($otherUser)->getJson(route('retros.surveys.show', [$retro, $survey]))
        ->assertJsonPath('survey.comments.0.author', null)
        ->assertDontSee($participant->id);
});

it('attaches replies to the top-level comment and refuses parents of another survey', function () {
    [$retro, $user, , $survey] = discussedSurvey(RetroPhase::Discussing, [], ['is_closed' => true]);
    $parent = SurveyComment::factory()->create(['retro_id' => $retro->id, 'survey_id' => $survey->id]);
    $reply = SurveyComment::factory()->create(['retro_id' => $retro->id, 'survey_id' => $survey->id, 'parent_comment_id' => $parent->id]);
    $foreign = SurveyComment::factory()->create(['retro_id' => $retro->id]);
    $route = route('retros.surveys.comments.store', [$retro, $survey]);

    $this->actingAs($user)->postJson($route, ['content' => 'Me too', 'parentCommentId' => $reply->id])
        ->assertCreated()
        ->assertJsonPath('comment.parentCommentId', $parent->id);
    $this->actingAs($user)->postJson($route, ['content' => 'Lost', 'parentCommentId' => $foreign->id])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['parentCommentId' => 'The reply must belong to a comment on the same survey.']);
});

it('lets authors edit and authors or the facilitator delete survey comments', function () {
    [$retro, $user, $participant, $survey] = discussedSurvey(RetroPhase::Discussing, [], ['is_closed' => true]);
    [$facilitatorUser] = retroFacilitator($retro);
    [$otherUser] = retroMember($retro);
    $comment = SurveyComment::factory()->create(['retro_id' => $retro->id, 'survey_id' => $survey->id, 'participant_id' => $participant->id]);
    SurveyComment::factory()->create(['retro_id' => $retro->id, 'survey_id' => $survey->id, 'parent_comment_id' => $comment->id]);

    $this->actingAs($otherUser)->patchJson(route('retros.survey-comments.update', [$retro, $comment]), ['content' => 'Hijack'])->assertForbidden();
    $this->actingAs($user)->patchJson(route('retros.survey-comments.update', [$retro, $comment]), ['content' => 'Edited'])
        ->assertOk()
        ->assertJsonPath('comment.content', 'Edited');
    $this->actingAs($otherUser)->deleteJson(route('retros.survey-comments.destroy', [$retro, $comment]))->assertForbidden();
    $this->actingAs($facilitatorUser)->deleteJson(route('retros.survey-comments.destroy', [$retro, $comment]))->assertNoContent();

    expect($comment->fresh()->isDeleted())->toBeTrue()
        ->and($comment->fresh()->content)->toBeNull();
    Event::assertDispatched(SurveyDiscussionChanged::class, fn (SurveyDiscussionChanged $event) => $event->commentCount === 1);
});

it('returns 404 for survey comments of another retro', function () {
    [$retro, $user] = discussedSurvey();
    $foreign = SurveyComment::factory()->create();

    $this->actingAs($user)->patchJson(route('retros.survey-comments.update', [$retro, $foreign]), ['content' => 'x'])->assertNotFound();
});

it('notifies the survey creator and thread participants who can see the results', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Discussing)->create();
    [, $creator] = retroFacilitator($retro);
    [, $threadStarter] = retroMember($retro);
    [, $withdrawn] = retroMember($retro);
    [$replierUser, $replier] = retroMember($retro);
    $survey = Survey::factory()->withOptions()->create(['retro_id' => $retro->id, 'created_by_participant_id' => $creator->id]);
    answerSurvey($survey, $creator, 0);
    answerSurvey($survey, $threadStarter, 1);
    answerSurvey($survey, $replier, 2);
    $thread = SurveyComment::factory()->create(['retro_id' => $retro->id, 'survey_id' => $survey->id, 'participant_id' => $threadStarter->id]);
    SurveyComment::factory()->create(['retro_id' => $retro->id, 'survey_id' => $survey->id, 'participant_id' => $withdrawn->id, 'parent_comment_id' => $thread->id]);

    $this->actingAs($replierUser)->postJson(route('retros.surveys.comments.store', [$retro, $survey]), [
        'content' => 'Replying',
        'parentCommentId' => $thread->id,
    ])->assertCreated();

    $notified = [];
    Event::assertDispatched(CommentNotification::class, function (CommentNotification $event) use (&$notified, $survey, $thread, $replierUser) {
        $notified[] = $event->participantId;

        return $event->notification['surveyId'] === $survey->id
            && $event->notification['threadId'] === $thread->id
            && $event->notification['authorName'] === $replierUser->name
            && ! array_key_exists('cardId', $event->notification);
    });

    expect($notified)->toEqualCanonicalizing([$creator->id, $threadStarter->id]);
});

it('leaves the author name out of survey notifications on anonymous retros', function () {
    [$retro, $user, $participant, $survey] = discussedSurvey(RetroPhase::Discussing, ['is_anonymous' => true], ['is_closed' => true]);

    $this->actingAs($user)->postJson(route('retros.surveys.comments.store', [$retro, $survey]), ['content' => 'Hi'])->assertCreated();

    Event::assertDispatched(CommentNotification::class, fn (CommentNotification $event) => $event->participantId === $survey->created_by_participant_id
        && ! array_key_exists('authorName', $event->notification));
});

it('refuses reactions and comments after the participant withdraws their answer from an open survey', function () {
    [$retro, $user, $participant, $survey] = discussedSurvey();
    answerSurvey($survey, $participant, 0);

    $this->actingAs($user)->deleteJson(route('retros.surveys.response.destroy', [$retro, $survey]))->assertOk();

    $this->actingAs($user)->putJson(route('retros.surveys.reactions.update', [$retro, $survey]), ['emoji' => '👍'])
        ->assertForbidden()
        ->assertJsonPath('message', 'Answer the survey to join the discussion.');
    $this->actingAs($user)->postJson(route('retros.surveys.comments.store', [$retro, $survey]), ['content' => 'Sneaky'])
        ->assertForbidden()
        ->assertJsonPath('message', 'Answer the survey to join the discussion.');
});

it('refuses editing and deleting survey comments while the retro is locked', function () {
    [$retro, $user, $participant, $survey] = discussedSurvey(RetroPhase::Discussing, ['is_locked' => true], ['is_closed' => true]);
    $comment = SurveyComment::factory()->create(['retro_id' => $retro->id, 'survey_id' => $survey->id, 'participant_id' => $participant->id]);

    $this->actingAs($user)->patchJson(route('retros.survey-comments.update', [$retro, $comment]), ['content' => 'Edited'])->assertStatus(423);
    $this->actingAs($user)->deleteJson(route('retros.survey-comments.destroy', [$retro, $comment]))->assertStatus(423);
});
