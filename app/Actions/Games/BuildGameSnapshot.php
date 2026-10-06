<?php

namespace App\Actions\Games;

use App\Enums\GameRoomAccess;
use App\Models\GamePlayer;
use App\Models\GameRoom;
use App\Support\EmojiData;
use App\Support\Games\GameRoomSettings;
use App\Support\Games\GameRulesRegistry;
use App\Support\Sessions\JoinCodes;

/**
 * @phpstan-type Snapshot array{
 *     room: array{
 *         id: string,
 *         name: ?string,
 *         game: string,
 *         locale: string,
 *         access: string,
 *         reactionsEnabled: bool,
 *         settings: array{wordThemes: array<int, string>, turnSeconds: ?int, autoHints: bool, takesTurns: bool, roundsPerGame: ?int, gifVotes: int, gifAuthorsHidden: bool},
 *         timerEndsAt: ?string,
 *         isHost: bool,
 *         canManage: bool,
 *         canDelete: bool,
 *         canBecomeHost: bool,
 *         hostPlayerId: ?string,
 *         guestUrl: ?string,
 *         joinCode: ?string,
 *         isIcebreaker: bool,
 *         currentRoundId: ?string,
 *         teamName: ?string
 *     },
 *     me: array{playerId: string, userId: ?string, isGuest: bool},
 *     players: array<int, array{id: string, presenceId: string, name: string, avatarUrl: string, isGuest: bool, presence: int}>,
 *     games: array<int, array{value: string, label: string, available: bool}>,
 *     round: ?array<string, mixed>,
 *     truthSets: array{ready: array<int, string>, mine: array{statements: array<int, string>, lieIndex: int, played: bool}|null}|null,
 *     history: array<int, array<string, mixed>>,
 *     links: array{team: ?string, retro: ?string},
 *     emojiData: array{baseUrl: string, locale: string},
 *     leaderboard: array<int, array{playerId: string, points: int, wins: int, roundsPlayed: int}>,
 *     scoresResetAt: ?string,
 *     share: array{slack: bool, telegram: bool},
 *     deliveries: array<int, array<string, mixed>>,
 *     viewerIsObserver: bool,
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
        private RoomLeaderboard $roomLeaderboard,
        private GameRoomShares $gameRoomShares,
        private JoinCodes $joinCodes,
        private PresentStatementSets $presentStatementSets,
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
        $canTakeHosting = $canTakeOver || (! $isGuest && ($viewer->account()?->can('takeControl', $room->team) ?? false));
        $round = $room->activeRound();
        $guestUrl = $isStandalone && $isManager && $room->access === GameRoomAccess::Link ? $room->guestUrl() : null;

        return [
            'room' => [
                'id' => $room->id,
                'name' => $room->name,
                'game' => $room->game->value,
                'locale' => $room->locale,
                'access' => $room->access->value,
                'reactionsEnabled' => $room->reactions_enabled,
                'settings' => GameRoomSettings::present($room),
                'timerEndsAt' => $room->effectiveTimerEndsAt()?->toIso8601String(),
                'isHost' => $isHost,
                'canManage' => $isManager,
                'canDelete' => $isStandalone && $canTakeOver,
                'canBecomeHost' => $isStandalone && ! $isHost && $canTakeHosting,
                'hostPlayerId' => $this->hostPlayerId($room),
                'guestUrl' => $guestUrl,
                'joinCode' => $guestUrl === null ? null : $this->joinCodes->for($room),
                'isIcebreaker' => ! $isStandalone,
                'currentRoundId' => $room->current_round_id,
                'teamName' => $isGuest ? null : $room->team->name,
                'maxOnlinePlayers' => GameRoom::MaxOnlinePlayers,
            ],
            'me' => [
                'playerId' => $viewer->id,
                'userId' => $viewer->accountUserId(),
                'isGuest' => $isGuest,
            ],
            'players' => $room->players->map(fn (GamePlayer $player): array => $this->presentGamePlayer->handle($player))->values()->all(),
            'games' => $this->gameRulesRegistry->options($room),
            'round' => $round === null ? null : $this->presentGameRound->handle($round, $room, $viewer),
            'truthSets' => $this->presentStatementSets->handle($room, $viewer),
            'history' => $this->presentGameRoundHistory->forRoom($room),
            'links' => [
                'team' => $isStandalone && ! $isGuest ? route('teams.show', [$room->team->workspace, $room->team]) : null,
                'retro' => $isStandalone ? null : route('retros.show', $room->retro_id),
            ],
            'emojiData' => EmojiData::location(),
            'leaderboard' => $this->roomLeaderboard->handle($room),
            'scoresResetAt' => $isStandalone ? $room->scores_reset_at?->toIso8601String() : null,
            'share' => $this->gameRoomShares->availability($room, $viewer),
            'deliveries' => $this->gameRoomShares->deliveries($room, $viewer),
            'viewerIsObserver' => $viewer->account()?->isObserverOf($room->team) ?? false,
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
