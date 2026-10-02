<?php

use App\Enums\HealthStatement;
use App\Exceptions\ModelInvariantViolation;
use App\Models\ActionItem;
use App\Models\Participant;
use App\Models\SavedPokerDeck;
use App\Models\Team;
use App\Models\TeamHealthStatement;
use App\Models\User;
use Illuminate\Support\Facades\Event;

it('refuses a member and a guest assignee at once', function () {
    $guest = Participant::factory()->guest()->create();

    expect(fn () => ActionItem::factory()->create([
        'retro_id' => $guest->retro_id,
        'assignee_participant_id' => $guest->id,
        'assignee_user_id' => User::factory()->create()->id,
    ]))->toThrow(ModelInvariantViolation::class);
});

it('refuses a guest assignee on an item without a retro', function () {
    $guest = Participant::factory()->guest()->create();
    $team = $guest->retro->team;

    expect(fn () => ActionItem::factory()->withoutRetro($team, teamMember($team))->create(['assignee_participant_id' => $guest->id]))
        ->toThrow(ModelInvariantViolation::class);
});

it('refuses a recurrence without a due date', function () {
    expect(fn () => ActionItem::factory()->create(['recurrence' => 'weekly', 'due_on' => null]))
        ->toThrow(ModelInvariantViolation::class);
});

it('refuses a recurrence that loses its due date on update', function () {
    $item = ActionItem::factory()->create(['recurrence' => 'weekly', 'due_on' => '2026-10-10']);

    expect(fn () => $item->update(['due_on' => null]))->toThrow(ModelInvariantViolation::class)
        ->and($item->fresh()->due_on?->toDateString())->toBe('2026-10-10');
});

it('refuses a guest assignee added to an item that already has a member', function () {
    $guest = Participant::factory()->guest()->create();
    $member = User::factory()->create();
    $item = ActionItem::factory()->assignedTo($member)->create(['retro_id' => $guest->retro_id]);

    expect(fn () => $item->update(['assignee_participant_id' => $guest->id]))->toThrow(ModelInvariantViolation::class)
        ->and($item->fresh()->assignee_participant_id)->toBeNull()
        ->and($item->fresh()->assignee_user_id)->toBe($member->id);
});

it('refuses an item that leaves its retro while a guest is assigned', function () {
    $guest = Participant::factory()->guest()->create();
    $item = ActionItem::factory()->assignedToGuest($guest)->create();

    expect(fn () => $item->update(['retro_id' => null]))->toThrow(ModelInvariantViolation::class)
        ->and($item->fresh()->retro_id)->toBe($guest->retro_id);
});

it('refuses a built-in team statement that also has a text, and a custom one without a label', function (array $attributes) {
    expect(fn () => TeamHealthStatement::factory()->create($attributes))->toThrow(ModelInvariantViolation::class);
})->with([
    'built-in with a text' => [['builtin' => HealthStatement::Vision, 'text' => 'Reworded', 'label' => 'Vision']],
    'custom without a label' => [['builtin' => null, 'text' => 'We ship weekly', 'label' => null]],
    'neither' => [['builtin' => null, 'text' => null, 'label' => null]],
]);

it('refuses a deck with both owners or none', function (bool $withTeam, bool $withWorkspace) {
    $team = Team::factory()->create();

    expect(fn () => SavedPokerDeck::factory()->create([
        'team_id' => $withTeam ? $team->id : null,
        'workspace_id' => $withWorkspace ? $team->workspace_id : null,
    ]))->toThrow(ModelInvariantViolation::class);
})->with([
    'both owners' => [true, true],
    'no owner' => [false, false],
]);

it('accepts the rows the rules allow', function () {
    $team = Team::factory()->create();

    expect(SavedPokerDeck::factory()->create(['team_id' => $team->id])->exists)->toBeTrue()
        ->and(SavedPokerDeck::factory()->forWorkspace($team->workspace)->create()->exists)->toBeTrue()
        ->and(TeamHealthStatement::factory()->create(['team_id' => $team->id, 'builtin' => HealthStatement::Vision, 'text' => null, 'label' => null])->exists)->toBeTrue()
        ->and(TeamHealthStatement::factory()->create(['team_id' => $team->id])->exists)->toBeTrue()
        ->and(ActionItem::factory()->create(['recurrence' => 'weekly', 'due_on' => '2026-10-10'])->exists)->toBeTrue();
});

it('keeps the rules when model events are faked or muted', function () {
    $team = Team::factory()->create();
    $item = ActionItem::factory()->create(['recurrence' => 'weekly', 'due_on' => '2026-10-10']);
    $statement = TeamHealthStatement::factory()->create(['team_id' => $team->id]);
    $deck = SavedPokerDeck::factory()->create(['team_id' => $team->id]);

    Event::fake();

    expect(fn () => $item->fill(['due_on' => null])->saveQuietly())->toThrow(ModelInvariantViolation::class)
        ->and(fn () => $statement->fill(['label' => null])->save())->toThrow(ModelInvariantViolation::class)
        ->and(fn () => $deck->forceFill(['workspace_id' => $team->workspace_id])->save())->toThrow(ModelInvariantViolation::class);
});

it('names the model and the rule it broke', function () {
    expect(fn () => ActionItem::factory()->create(['recurrence' => 'weekly', 'due_on' => null]))
        ->toThrow(ModelInvariantViolation::class, 'ActionItem: a recurrence needs a due date');
});
