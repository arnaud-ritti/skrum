<?php

namespace Database\Factories;

use App\Models\ActionItem;
use App\Models\ActionItemComment;
use App\Models\Participant;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<ActionItemComment>
 */
class ActionItemCommentFactory extends Factory
{
    public function definition(): array
    {
        return [
            'action_item_id' => ActionItem::factory(),
            'author_participant_id' => null,
            'author_user_id' => User::factory(),
            'content' => fake()->sentence(),
        ];
    }

    public function byParticipant(Participant $participant): static
    {
        return $this->state(fn () => ['author_participant_id' => $participant->id, 'author_user_id' => null]);
    }
}
