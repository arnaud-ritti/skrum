<?php

use App\Actions\ActionItems\ActionItemActor;
use App\Actions\Retros\PresentActionItem;
use App\Enums\ActionItemPriority;
use App\Enums\RetroPhase;
use App\Models\ActionItem;
use App\Models\ActionItemComment;
use App\Models\Participant;
use App\Models\Retro;
use App\Models\Team;
use Carbon\CarbonImmutable;

function presentedActionItem(ActionItem $item, ?ActionItemActor $viewer = null): array
{
    return app(PresentActionItem::class)->handle($item->fresh()->loadForPresentation(), $viewer);
}

it('presents every field of a board item', function () {
    $this->travelTo(CarbonImmutable::parse('2026-10-05 09:00:00'));
    $retro = Retro::factory()->inPhase(RetroPhase::Discussing)->create(['title' => 'Sprint 12']);
    [$authorUser, $author] = retroMember($retro);
    [$assignee] = retroMember($retro);
    $item = ActionItem::factory()->assignedTo($assignee)->priority(ActionItemPriority::High)->create([
        'retro_id' => $retro->id,
        'created_by_participant_id' => $author->id,
        'content' => 'Speed up CI',
        'due_on' => '2026-10-03',
    ]);
    ActionItemComment::factory()->count(2)->create(['action_item_id' => $item->id]);

    expect(presentedActionItem($item))->toBe([
        'id' => $item->id,
        'retroId' => $retro->id,
        'teamId' => $retro->team_id,
        'content' => 'Speed up CI',
        'priority' => 'high',
        'dueOn' => '2026-10-03',
        'isOverdue' => true,
        'status' => 'open',
        'completedAt' => null,
        'assignee' => [
            'kind' => 'member',
            'id' => $assignee->id,
            'name' => $assignee->name,
            'avatarUrl' => $assignee->avatarUrl(),
            'isTeamMember' => true,
        ],
        'createdBy' => ['name' => $authorUser->name, 'avatarUrl' => $author->avatarUrl()],
        'isMine' => false,
        'commentCount' => 2,
        'source' => [
            'retroTitle' => 'Sprint 12',
            'retroCreatedAt' => $retro->created_at?->toIso8601String(),
            'retroUrl' => route('retros.show', $retro),
        ],
        'themeId' => null,
        'themeName' => null,
        'recurrence' => null,
        'previousOccurrenceId' => null,
        'subtasks' => [],
        'createdAt' => $item->created_at?->toIso8601String(),
    ]);
});

it('presents guest assignees, completion and items without a retro', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Discussing)->create();
    $guest = Participant::factory()->guest()->create(['retro_id' => $retro->id, 'guest_name' => 'Robin']);
    $guestItem = ActionItem::factory()->assignedToGuest($guest)->completed()->create();
    $team = Team::factory()->create();
    $author = teamMember($team);
    $teamItem = ActionItem::factory()->withoutRetro($team, $author)->create();

    expect(presentedActionItem($guestItem))->toMatchArray([
        'assignee' => ['kind' => 'guest', 'id' => $guest->id, 'name' => 'Robin', 'avatarUrl' => $guest->avatarUrl(), 'isTeamMember' => false],
        'status' => 'completed',
        'isOverdue' => false,
    ])
        ->and(presentedActionItem($guestItem)['completedAt'])->not->toBeNull()
        ->and(presentedActionItem($teamItem))->toMatchArray([
            'retroId' => null,
            'source' => null,
            'createdBy' => ['name' => $author->name, 'avatarUrl' => $author->avatarUrl()],
        ]);
});

it('names the creator on anonymous retros', function () {
    $retro = Retro::factory()->anonymous()->inPhase(RetroPhase::Discussing)->create();
    [$authorUser, $author] = retroMember($retro);
    $item = ActionItem::factory()->create(['retro_id' => $retro->id, 'created_by_participant_id' => $author->id]);

    expect(presentedActionItem($item)['createdBy'])->toBe(['name' => $authorUser->name, 'avatarUrl' => $author->avatarUrl()]);
});

it('tells the viewer which items are theirs', function () {
    $retro = Retro::factory()->create();
    [$user, $author] = retroMember($retro);
    [, $other] = retroMember($retro);
    $item = ActionItem::factory()->create(['retro_id' => $retro->id, 'created_by_participant_id' => $author->id]);

    expect(presentedActionItem($item, ActionItemActor::forParticipant($author))['isMine'])->toBeTrue()
        ->and(presentedActionItem($item, ActionItemActor::forUser($user))['isMine'])->toBeTrue()
        ->and(presentedActionItem($item, ActionItemActor::forParticipant($other))['isMine'])->toBeFalse()
        ->and(presentedActionItem($item)['isMine'])->toBeFalse();
});

it('flags assignees who left the team and forgets deleted authors', function () {
    $retro = Retro::factory()->create();
    [$assignee] = retroMember($retro);
    $team = $retro->team;
    $author = teamMember($team);
    $item = ActionItem::factory()->withoutRetro($team, $author)->assignedTo($assignee)->create();

    $team->members()->detach($assignee);
    $author->delete();

    expect(presentedActionItem($item)['createdBy'])->toBeNull()
        ->and(presentedActionItem($item)['assignee']['isTeamMember'])->toBeFalse();
});
