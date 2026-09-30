<?php

namespace Database\Factories;

use App\Enums\ActionItemPriority;
use App\Models\ActionItem;
use App\Models\ActionItemSubtask;
use App\Models\Participant;
use App\Models\Retro;
use App\Models\Team;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Database\Eloquent\Factories\Sequence;

/**
 * @extends Factory<ActionItem>
 */
class ActionItemFactory extends Factory
{
    public function definition(): array
    {
        return [
            'retro_id' => Retro::factory(),
            'team_id' => fn (array $attributes) => $attributes['retro_id'] === null
                ? Team::factory()
                : Retro::query()->whereKey($attributes['retro_id'])->value('team_id'),
            'content' => fake()->sentence(),
            'priority' => ActionItemPriority::Medium,
            'created_by_participant_id' => fn (array $attributes) => $attributes['retro_id'] === null
                ? null
                : Participant::factory()->create(['retro_id' => $attributes['retro_id']])->id,
            'created_by_user_id' => fn (array $attributes) => $attributes['created_by_participant_id'] === null
                ? null
                : Participant::query()->whereKey($attributes['created_by_participant_id'])->value('user_id'),
        ];
    }

    public function completed(): static
    {
        return $this->state(fn () => ['completed_at' => now()]);
    }

    public function overdue(): static
    {
        return $this->state(fn () => [
            'due_on' => ActionItem::today()->subDays(3)->toDateString(),
            'completed_at' => null,
        ]);
    }

    public function assignedTo(User $user): static
    {
        return $this->state(fn () => ['assignee_user_id' => $user->id, 'assignee_participant_id' => null]);
    }

    public function assignedToGuest(Participant $guest): static
    {
        return $this->state(fn () => [
            'retro_id' => $guest->retro_id,
            'assignee_participant_id' => $guest->id,
            'assignee_user_id' => null,
        ]);
    }

    public function priority(ActionItemPriority $priority): static
    {
        return $this->state(fn () => ['priority' => $priority]);
    }

    public function withoutRetro(Team $team, User $author): static
    {
        return $this->state(fn () => [
            'retro_id' => null,
            'team_id' => $team->id,
            'created_by_participant_id' => null,
            'created_by_user_id' => $author->id,
        ]);
    }

    public function withSubtasks(int $count): static
    {
        return $this->has(
            ActionItemSubtask::factory()->count($count)->state(new Sequence(fn (Sequence $sequence) => ['position' => $sequence->index])),
            'subtasks',
        );
    }
}
