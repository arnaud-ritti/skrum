<?php

namespace App\Mcp;

use App\Models\ActionItem;
use App\Models\Participant;
use App\Models\PokerGame;
use App\Models\PokerPlayer;
use App\Models\Retro;
use App\Models\Team;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Support\Str;

class McpContext
{
    public function __construct(
        private McpGrant $grant,
        private VisibleTeams $visibleTeams,
    ) {}

    public function user(): User
    {
        return $this->grant->user;
    }

    /**
     * @return array<int, string>
     */
    public function visibleTeamIds(): array
    {
        return $this->visibleTeams->ids($this->grant);
    }

    public function team(string $id): Team
    {
        return $this->find(Team::query()->whereIn('id', $this->visibleTeamIds()), $id);
    }

    public function retro(string $id): Retro
    {
        return $this->find(Retro::query()->whereIn('team_id', $this->visibleTeamIds()), $id);
    }

    public function pokerGame(string $id): PokerGame
    {
        return $this->find(PokerGame::query()->whereIn('team_id', $this->visibleTeamIds()), $id);
    }

    public function actionItem(string $id): ActionItem
    {
        return $this->find(ActionItem::query()->whereIn('team_id', $this->visibleTeamIds()), $id);
    }

    public function participant(Retro $retro): ?Participant
    {
        return Participant::query()
            ->where('retro_id', $retro->id)
            ->where('user_id', $this->user()->id)
            ->first();
    }

    public function participantForWrite(Retro $retro): Participant
    {
        return Participant::query()->firstOrCreate([
            'retro_id' => $retro->id,
            'user_id' => $this->user()->id,
        ]);
    }

    public function pokerPlayer(PokerGame $game): ?PokerPlayer
    {
        return PokerPlayer::query()
            ->where('poker_game_id', $game->id)
            ->where('user_id', $this->user()->id)
            ->first();
    }

    public function pokerPlayerForWrite(PokerGame $game): PokerPlayer
    {
        return PokerPlayer::query()->firstOrCreate(
            ['poker_game_id' => $game->id, 'user_id' => $this->user()->id],
            ['is_spectator' => false],
        );
    }

    /**
     * @template TModel of Model
     *
     * @param  Builder<TModel>  $query
     * @return TModel
     */
    private function find(Builder $query, string $id): Model
    {
        if (! Str::isUuid($id)) {
            throw (new ModelNotFoundException)->setModel($query->getModel()::class);
        }

        return $query->whereKey($id)->firstOrFail();
    }
}
