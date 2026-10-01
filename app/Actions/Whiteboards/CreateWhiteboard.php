<?php

namespace App\Actions\Whiteboards;

use App\Models\Team;
use App\Models\User;
use App\Models\Whiteboard;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * @phpstan-import-type Scene from CopyWhiteboardScene
 */
class CreateWhiteboard
{
    public function __construct(private CopyWhiteboardScene $copyWhiteboardScene) {}

    /**
     * @param  Scene  $scene
     */
    public function handle(Team $team, User $creator, string $title, array $scene = ['elements' => [], 'files' => []]): Whiteboard
    {
        return DB::transaction(function () use ($team, $creator, $title, $scene): Whiteboard {
            $board = $team->whiteboards()->create([
                'title' => $title,
                'guest_token' => Str::random(40),
            ]);

            $member = $board->members()->create(['user_id' => $creator->id]);

            $board->update(['facilitator_member_id' => $member->id]);

            $this->copyWhiteboardScene->handle($board, $member, $scene);

            return $board;
        });
    }
}
