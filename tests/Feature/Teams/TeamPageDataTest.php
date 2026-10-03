<?php

use App\Models\ActionItem;
use App\Models\Card;
use App\Models\Participant;
use App\Models\Retro;
use App\Models\Team;
use App\Models\Whiteboard;
use Carbon\CarbonImmutable;
use Inertia\Testing\AssertableInertia as Assert;

it('sends the first five open action items, overdue first, with the overdue count', function () {
    $team = Team::factory()->create();
    $this->travelTo(CarbonImmutable::parse('2026-10-01 09:00', 'UTC'));
    $make = fn (string $content, ?string $dueOn, bool $done = false) => ActionItem::factory()->for($team)->create([
        'retro_id' => null,
        'content' => $content,
        'due_on' => $dueOn,
        'completed_at' => $done ? now() : null,
    ]);
    $make('Later', '2026-10-20');
    $make('Late two', '2026-09-26');
    $make('No date', null);
    $make('Late one', '2026-09-20');
    $make('Soon', '2026-10-03');
    $make('Next week', '2026-10-08');
    $make('Done and late', '2026-09-01', true);

    $this->actingAs(teamMember($team))->get(route('teams.show', [$team->workspace, $team]))
        ->assertInertia(fn (Assert $page) => $page
            ->where('overdueActionItemCount', 2)
            ->where('openActionItemCount', 6)
            ->has('openActionItems', 5)
            ->where('openActionItems.0.content', 'Late one')
            ->where('openActionItems.1.content', 'Late two')
            ->where('openActionItems.2.content', 'Soon')
            ->where('openActionItems.4.content', 'Later'));
});

it('counts the participants, cards, groups and action items of each retro', function () {
    $team = Team::factory()->create();
    $retro = Retro::factory()->for($team)->create();
    [$author, $other] = Participant::factory()->count(2)->create(['retro_id' => $retro->id]);
    $parent = Card::factory()->create(['retro_id' => $retro->id, 'participant_id' => $author->id]);
    Card::factory()->create(['retro_id' => $retro->id, 'participant_id' => $other->id, 'column_id' => $parent->column_id, 'parent_card_id' => $parent->id]);
    Card::factory()->create(['retro_id' => $retro->id, 'participant_id' => $author->id, 'column_id' => $parent->column_id]);
    ActionItem::factory()->for($team)->create(['retro_id' => $retro->id, 'created_by_participant_id' => $author->id]);

    $this->actingAs(teamMember($team))->get(route('teams.show', [$team->workspace, $team]))
        ->assertInertia(fn (Assert $page) => $page
            ->where('retros.0.stats', ['participants' => 2, 'cards' => 3, 'groups' => 1, 'actionItems' => 1]));
});

it('counts the whiteboards edited today on the workspace tile', function () {
    $team = Team::factory()->create();
    $this->travelTo(CarbonImmutable::parse('2026-10-01 15:00', 'UTC'));
    Whiteboard::factory()->for($team)->create(['updated_at' => now()->subHours(2)]);
    Whiteboard::factory()->for($team)->create(['updated_at' => now()->subDay()]);

    $this->actingAs(teamMember($team))->get(route('workspaces.show', $team->workspace))
        ->assertInertia(fn (Assert $page) => $page->where('teams.0.activity.whiteboardsEditedToday', 1));
});
