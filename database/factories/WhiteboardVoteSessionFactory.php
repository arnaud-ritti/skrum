<?php

namespace Database\Factories;

use App\Models\Whiteboard;
use App\Models\WhiteboardVoteSession;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<WhiteboardVoteSession>
 */
class WhiteboardVoteSessionFactory extends Factory
{
    public function definition(): array
    {
        return [
            'whiteboard_id' => Whiteboard::factory(),
            'votes_per_member' => 3,
            'allow_multiple' => false,
            'element_ids' => [],
        ];
    }

    /**
     * @param  list<array{elementId: string, text: string, count: int}>  $results
     */
    public function closed(array $results = []): static
    {
        return $this->state(fn () => ['closed_at' => now(), 'results' => $results]);
    }
}
