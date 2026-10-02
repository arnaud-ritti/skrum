<?php

use App\Enums\ActionItemPriority;
use App\Models\ActionItem;
use App\Models\ActionItemComment;
use App\Models\Participant;
use App\Models\Retro;
use App\Models\Team;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;

it('derives the team and the author from the creating participant', function () {
    $item = ActionItem::factory()->create();

    expect($item->team_id)->toBe($item->retro->team_id)
        ->and($item->created_by_user_id)->toBe($item->createdByParticipant->user_id)
        ->and($item->author->is($item->createdByParticipant->user))->toBeTrue()
        ->and($item->fresh()->priority)->toBe(ActionItemPriority::Medium)
        ->and($item->hasRetro())->toBeTrue()
        ->and($item->team->actionItems()->pluck('id')->all())->toBe([$item->id]);
});

it('keeps items added outside a retro on their team and workspace', function () {
    $team = Team::factory()->create();
    $author = teamMember($team);

    $item = ActionItem::factory()->withoutRetro($team, $author)->create();

    expect($item->hasRetro())->toBeFalse()
        ->and($item->retro)->toBeNull()
        ->and($item->created_by_participant_id)->toBeNull()
        ->and($item->author->is($author))->toBeTrue()
        ->and($team->workspace->actionItems()->pluck('action_items.id')->all())->toBe([$item->id]);
});

it('flags open items due before today as overdue', function (?string $dueOn, bool $completed, bool $overdue) {
    $this->travelTo(CarbonImmutable::parse('2026-10-05 12:00:00'));
    $item = ActionItem::factory()->create(['due_on' => $dueOn, 'completed_at' => $completed ? now() : null]);

    expect($item->fresh()->isOverdue(ActionItem::today()))->toBe($overdue);
})->with([
    'due yesterday' => ['2026-10-04', false, true],
    'due today' => ['2026-10-05', false, false],
    'due tomorrow' => ['2026-10-06', false, false],
    'completed late' => ['2026-10-01', true, false],
    'no due date' => [null, false, false],
]);

it('decides what today is in the instance time zone', function () {
    $this->travelTo(CarbonImmutable::parse('2026-10-05 23:30:00', 'UTC'));
    $item = ActionItem::factory()->create(['due_on' => '2026-10-05'])->fresh();

    expect($item->isOverdue(ActionItem::today()))->toBeFalse();

    config(['app.timezone' => 'Europe/Paris']);

    expect($item->isOverdue(ActionItem::today()))->toBeTrue();
});

it('refuses a member and a guest assignee at once', function () {
    $guest = Participant::factory()->guest()->create();

    expect(fn () => DB::transaction(fn () => ActionItem::factory()->create([
        'retro_id' => $guest->retro_id,
        'assignee_participant_id' => $guest->id,
        'assignee_user_id' => User::factory()->create()->id,
    ])))->toThrow(QueryException::class);
});

it('refuses a guest assignee on an item without a retro', function () {
    $guest = Participant::factory()->guest()->create();
    $team = $guest->retro->team;

    expect(fn () => DB::transaction(fn () => ActionItem::factory()->withoutRetro($team, teamMember($team))->create([
        'assignee_participant_id' => $guest->id,
    ])))->toThrow(QueryException::class);
});

it('refuses a recurrence without a due date', function () {
    expect(fn () => DB::transaction(fn () => ActionItem::factory()->create(['recurrence' => 'weekly', 'due_on' => null])))
        ->toThrow(QueryException::class);
});

it('unassigns items when the assigned user is deleted', function () {
    $user = User::factory()->create();
    $item = ActionItem::factory()->assignedTo($user)->create();

    $user->delete();

    expect($item->fresh()->assignee_user_id)->toBeNull();
});

it('deletes items and their comments with the retro or the team', function () {
    $retro = Retro::factory()->create();
    $boardItem = ActionItem::factory()->create(['retro_id' => $retro->id]);
    ActionItemComment::factory()->create(['action_item_id' => $boardItem->id]);
    $team = Team::factory()->create();
    $teamItem = ActionItem::factory()->withoutRetro($team, teamMember($team))->create();

    $retro->delete();
    $team->delete();

    expect(ActionItem::whereKey([$boardItem->id, $teamItem->id])->count())->toBe(0)
        ->and(ActionItemComment::count())->toBe(0);
});

it('gives members the same avatar as their participants', function () {
    $participant = Participant::factory()->create();

    expect($participant->user->avatarUrl())->toBe($participant->avatarUrl());
});
