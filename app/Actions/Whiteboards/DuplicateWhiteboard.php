<?php

namespace App\Actions\Whiteboards;

use App\Models\User;
use App\Models\Whiteboard;
use Illuminate\Support\Facades\DB;

class DuplicateWhiteboard
{
    private const MaxTitleLength = 120;

    public function __construct(
        private CreateWhiteboard $createWhiteboard,
        private ReadWhiteboardScene $readWhiteboardScene,
    ) {}

    /**
     * The source is locked while it is read, so the copy is one moment of
     * the board and not a mix of two.
     */
    public function handle(Whiteboard $board, User $user): Whiteboard
    {
        return DB::transaction(function () use ($board, $user): Whiteboard {
            $locked = Whiteboard::query()->whereKey($board->id)->lockForUpdate()->firstOrFail();

            WhiteboardGuard::notPrivateWriting($locked);

            return $this->createWhiteboard->handle(
                $locked->team,
                $user,
                $this->title($locked->title),
                $this->readWhiteboardScene->handle($locked),
            );
        });
    }

    public function title(string $title): string
    {
        $room = self::MaxTitleLength - mb_strlen(__(':title (copy)', ['title' => '']));

        return __(':title (copy)', ['title' => rtrim(mb_substr($title, 0, $room))]);
    }
}
