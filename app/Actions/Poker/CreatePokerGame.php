<?php

namespace App\Actions\Poker;

use App\Actions\Integrations\ImportPokerTasks;
use App\Actions\Teams\RecordTeamActivity;
use App\Enums\TeamActivityKind;
use App\Models\PokerGame;
use App\Models\Team;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class CreatePokerGame
{
    public function __construct(
        private AddPokerTask $addPokerTask,
        private ImportPokerTasks $importPokerTasks,
        private RecordTeamActivity $recordTeamActivity,
    ) {}

    public function handle(Team $team, User $creator, NewPokerGame $new): PokerGame
    {
        return DB::transaction(function () use ($team, $creator, $new): PokerGame {
            if ($new->saveDeckAs !== null) {
                $lockedTeam = Team::query()->whereKey($team->id)->lockForUpdate()->firstOrFail();

                SavedPokerDeckRules::ensureRoom($lockedTeam, 'save_deck_as');
                SavedPokerDeckRules::ensureNameIsFree($lockedTeam, $new->saveDeckAs, attribute: 'save_deck_as');

                $lockedTeam->pokerDecks()->create([
                    'name' => $new->saveDeckAs,
                    'cards' => $new->cards,
                    'created_by_user_id' => $creator->id,
                ]);
            }

            $game = $team->pokerGames()->create([
                'title' => $new->title,
                'deck' => $new->deck,
                'cards' => $new->cards,
                'deck_name' => $new->deckName,
                'saved_deck_id' => $new->savedDeckId,
                'anonymous_votes' => $new->anonymousVotes,
                'auto_reveal' => $new->autoReveal,
                'guest_access_enabled' => $new->guestAccessEnabled,
                'revote_after_reveal' => $new->revoteAfterReveal,
                'task_timer_seconds' => $new->taskTimerSeconds,
                'writes_estimates' => $new->writesEstimates,
                'estimate_field_id' => $new->estimateFieldId,
                'guest_token' => Str::random(40),
            ]);

            $player = $game->players()->create(['user_id' => $creator->id, 'is_spectator' => $new->spectator]);

            $game->update(['facilitator_player_id' => $player->id]);
            $this->recordTeamActivity->handle($team->id, TeamActivityKind::PokerStarted, $creator, null, $game->id, $game->title);

            foreach ($new->tasks as $title) {
                $this->addPokerTask->handle($game, $title, null);
            }

            if ($new->import !== null) {
                $this->importPokerTasks->storeIssues($game, $new->import->integration, $new->import->externalIds, $new->import->issues);
            }

            return $game;
        });
    }
}
