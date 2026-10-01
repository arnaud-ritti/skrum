<?php

namespace Database\Factories;

use App\Models\WhiteboardMember;
use App\Models\WhiteboardVote;
use App\Models\WhiteboardVoteSession;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<WhiteboardVote>
 */
class WhiteboardVoteFactory extends Factory
{
    public function definition(): array
    {
        return [
            'whiteboard_vote_session_id' => WhiteboardVoteSession::factory(),
            'whiteboard_member_id' => WhiteboardMember::factory(),
            'element_id' => 'note',
            'count' => 1,
        ];
    }
}
