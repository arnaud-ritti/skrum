<?php

namespace App\Actions\Games;

use App\Enums\GameRoomAccess;
use App\Http\Controllers\EmojiDataController;
use App\Models\GamePlayer;
use App\Models\GameRoom;
use App\Support\Games\GameRulesRegistry;

/**
 * @phpstan-type Snapshot array{
 *     room: array{
 *         id: string,
 *         name: ?string,
 *         game: string,
 *         locale: string,
 *         access: string,
 *         timerEndsAt: ?string,
 *         isHost: bool,
 *         canManage: bool,
 *         canDelete: bool,
 *         canBecomeHost: bool,
 *         hostPlayerId: ?string,
 *         guestUrl: ?string,
 *         isIcebreaker: bool,
 *         currentRoundId: ?string
 *     },
 *     me: array{playerId: string, userId: ?string, isGuest: bool},
 *     players: array<int, array{id: string, presenceId: string, name: string, avatarUrl: string, isGuest: bool}>,
 *     games: array<int, array{value: string, label: string, available: bool}>,
 *     round: ?array<string, mixed>,
 *     history: array<int, array<string, mixed>>,
 *     links: array{team: ?string, retro: ?string},
 *     emojiData: array{baseUrl: string, locale: string},
 *     serverTime: string
 * }
 */
class BuildGameSnapshot
{
    public function __construct(
        private PresentGamePlayer $presentGamePlayer,
        private PresentGameRound $presentGameRound,
        private PresentGameRoundHistory $presentGameRoundHistory,
        private GameRulesRegistry $gameRulesRegistry,
    ) {}

    /**
     * @return Snapshot
     */
    public function handle(GameRoom $room, GamePlayer $viewer): array
    {
        $room->load(['team.workspace', 'retro', 'players.user', 'players.participant.user', 'currentRound']);
        $viewer->loadMissing(['user', 'participant.user']);

        $isStandalone = ! $room->isIcebreaker();
        $isGuest = $viewer->isGuest();
        $isHost = $room->isHost($viewer);
        $isManager = $room->isManager($viewer);
        $canTakeOver = ! $isGuest && ($room->isCreator($viewer) || ($viewer->account()?->canManage($room->team->workspace) ?? false));
        $round = $room->activeRound();

        return [
            'room' => [
                'id' => $room->id,
                'name' => $room->name,
                'game' => $room->game->value,
                'locale' => $room->locale,
                'access' => $room->access->value,
                'timerEndsAt' => $room->effectiveTimerEndsAt()?->toIso8601String(),
                'isHost' => $isHost,
                'canManage' => $isManager,
                'canDelete' => $isStandalone && $canTakeOver,
                'canBecomeHost' => $isStandalone && ! $isHost && $canTakeOver,
                'hostPlayerId' => $this->hostPlayerId($room),
                'guestUrl' => $isStandalone && $isManager && $room->access === GameRoomAccess::Link ? $room->guestUrl() : null,
                'isIcebreaker' => ! $isStandalone,
                'currentRoundId' => $room->current_round_id,
            ],
            'me' => [
                'playerId' => $viewer->id,
                'userId' => $viewer->accountUserId(),
                'isGuest' => $isGuest,
            ],
            'players' => $room->players->map(fn (GamePlayer $player): array => $this->presentGamePlayer->handle($player))->values()->all(),
            'games' => $this->gameRulesRegistry->options($room),
            'round' => $round === null ? null : $this->presentGameRound->handle($round, $room, $viewer),
            'history' => $this->presentGameRoundHistory->forRoom($room),
            'links' => [
                'team' => $isStandalone && ! $isGuest ? route('teams.show', [$room->team->workspace, $room->team]) : null,
                'retro' => $isStandalone ? null : route('retros.show', $room->retro_id),
            ],
            'emojiData' => [
                'baseUrl' => '/emoji-data/'.config('services.emoji_data.version'),
                'locale' => EmojiDataController::emojibaseLocale(app()->getLocale()),
            ],
            'serverTime' => now()->utc()->format('Y-m-d\TH:i:s.v\Z'),
        ];
    }

    private function hostPlayerId(GameRoom $room): ?string
    {
        if (! $room->isIcebreaker()) {
            return $room->host_player_id;
        }

        return $room->players->first(fn (GamePlayer $player): bool => $room->isHost($player))?->id;
    }
}
