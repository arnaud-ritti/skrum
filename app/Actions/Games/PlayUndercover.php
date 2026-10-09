<?php

namespace App\Actions\Games;

use App\Enums\GameKind;
use App\Enums\GameRoundOutcome;
use App\Events\Games\GameUndercoverChanged;
use App\Models\GamePlayer;
use App\Models\GameRoom;
use App\Models\GameRound;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\ConflictHttpException;

class PlayUndercover
{
    public function __construct(private EndGameRound $endGameRound) {}

    /** @return array{ended: array<string, mixed>|null} */
    public function handle(GameRoom $room, GameRound $round, GamePlayer $actor, int $version, string $action, ?string $choice = null): array
    {
        return DB::transaction(function () use ($room, $round, $actor, $version, $action, $choice): array {
            [$room, $round] = LockGameRound::handle($room, $round);
            GameGuard::mutable($room);
            GameGuard::activeRound($room, $round);
            GameGuard::roundGame($round, GameKind::Undercover);
            $state = $round->undercover_state;
            if ($state['version'] !== $version) {
                throw new ConflictHttpException(__('The game has moved on.'));
            }
            $survivors = array_values(array_diff($state['order'], $state['eliminated']));
            $ended = null;

            if ($action === 'vote' || $action === 'retract') {
                if (! in_array($actor->id, $survivors, true)) {
                    throw new AuthorizationException(__('Only players still in the game can vote.'));
                }
                if ($state['stage'] !== 'voting') {
                    throw new ConflictHttpException(__('Voting is not open.'));
                }
                if ($action === 'vote') {
                    if ($choice === $actor->id || ! in_array($choice, $state['candidates'], true)) {
                        throw ValidationException::withMessages(['choice' => __('This choice is not offered.')]);
                    }
                    $round->choices()->updateOrCreate(['player_id' => $actor->id], ['choice' => $choice]);
                } else {
                    $round->choices()->where('player_id', $actor->id)->delete();
                }
            } else {
                GameGuard::host($room, $actor);
                if ($state['stage'] === 'clues') {
                    $index = array_search($round->turn_player_id, $survivors, true);
                    $round->turn_player_id = $survivors[$index + 1] ?? null;
                    if ($round->turn_player_id === null) {
                        $state['stage'] = 'discussion';
                    }
                } else {
                    if ($state['stage'] === 'discussion') {
                        $state['stage'] = 'voting';
                        $state['candidates'] = $survivors;
                    } else {
                        $votes = $round->choices()->pluck('choice')->countBy();
                        if ($votes->isEmpty()) {
                            throw new ConflictHttpException(__('At least one vote is needed.'));
                        }
                        $tied = $votes->filter(fn (int $count): bool => $count === $votes->max())->keys()->all();
                        if (count($tied) > 1) {
                            $state['candidates'] = $tied;
                        } else {
                            $state['eliminated'][] = $tied[0];
                            $remaining = array_values(array_diff($survivors, $tied));
                            $undercoverCount = count(array_filter($remaining, fn (string $id): bool => $state['roles'][$id] === 'undercover'));
                            $civilianCount = count($remaining) - $undercoverCount;
                            $state['winner'] = $undercoverCount === 0 ? 'civilian' : ($undercoverCount >= $civilianCount ? 'undercover' : null);
                            if ($state['winner'] === null) {
                                $state['stage'] = 'clues';
                                $state['cycle']++;
                                $state['candidates'] = [];
                                $round->turn_order = $remaining;
                                $round->turn_player_id = $remaining[0];
                            }
                        }
                        $round->choices()->delete();
                    }
                }
                $state['version']++;
                $round->undercover_state = $state;
                $round->save();
                if ($state['winner'] !== null) {
                    $ended = $this->endGameRound->handle($room, $round, GameRoundOutcome::Finished);
                }
            }
            if ($ended === null) {
                new GameUndercoverChanged($room, $round->id)->sendToOthers();
            }

            return ['ended' => $ended];
        });
    }
}
