<?php

namespace App\Mcp\Tools\Poker;

use App\Actions\Poker\PokerGuard;
use App\Actions\Poker\PokerResult;
use App\Actions\Poker\PresentPokerRound;
use App\Actions\Poker\RevealPokerRound;
use App\Actions\Poker\SetPokerEstimate;
use App\Enums\McpScope;
use App\Enums\PokerRevealReason;
use App\Mcp\McpContext;
use App\Mcp\Tools\SkrumTool;
use App\Models\PokerGame;
use App\Models\PokerRound;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Laravel\Mcp\Request;
use Laravel\Mcp\Response;
use Laravel\Mcp\ResponseFactory;
use Laravel\Mcp\Server\Tools\Annotations\IsOpenWorld;
use Laravel\Mcp\Server\Tools\Annotations\IsReadOnly;

#[IsReadOnly(false)]
#[IsOpenWorld(false)]
class RevealTask extends SkrumTool
{
    protected string $name = 'poker.game.task.reveal';

    protected string $description = 'Reveal the cards of the task on the table (facilitator only) and store the estimate the game would suggest: the card nearest to the average for numeric decks, or the single most played card otherwise. When no card can be chosen the estimate is left unchanged. Votes cannot be cast or estimates set directly.';

    public function __construct(
        private McpContext $context,
        private RevealPokerRound $revealPokerRound,
        private SetPokerEstimate $setPokerEstimate,
        private PresentPokerRound $presentPokerRound,
    ) {}

    public function schema(JsonSchema $schema): array
    {
        return [
            'game_id' => $schema->string()->format('uuid')->required(),
            'task_id' => $schema->string()->format('uuid')->required(),
        ];
    }

    protected function requiredScope(): McpScope
    {
        return McpScope::Write;
    }

    protected function run(Request $request): Response|ResponseFactory
    {
        $validated = $request->validate([
            'game_id' => ['required', 'uuid'],
            'task_id' => ['required', 'uuid'],
        ]);

        $game = $this->context->pokerGame((string) $validated['game_id']);

        $this->refuseObserver($game->team);

        $result = DB::transaction(function () use ($game, $validated): array {
            $locked = PokerGame::query()->whereKey($game->id)->lockForUpdate()->firstOrFail();
            $player = $this->context->pokerPlayerForWrite($locked);

            PokerGuard::notEnded($locked);
            PokerGuard::facilitator($locked, $player);

            $task = $locked->tasks()->whereKey($validated['task_id'])->firstOrFail();

            if ($locked->current_task_id !== $task->id) {
                throw ValidationException::withMessages(['task_id' => __('This task is not on the table.')]);
            }

            $round = $task->latestRound()->lockForUpdate()->first();

            if ($round === null) {
                throw ValidationException::withMessages(['task_id' => __('This round has not started.')]);
            }

            if ($round->isRevealed()) {
                throw ValidationException::withMessages(['task_id' => __('These cards are already revealed.')]);
            }

            $this->revealPokerRound->handle($locked, $round, PokerRevealReason::Manual);

            $round->refresh()->load('votes');
            $card = $this->suggestedCard($round, $locked);

            if ($card !== null) {
                $task = $this->setPokerEstimate->handle($locked, $task, $card);
            }

            return [
                'round' => $this->presentPokerRound->handle($round, $locked->load('players'), $player->id),
                'estimate' => $card === null ? $task->estimate : $task->fresh()?->estimate,
                'estimateSet' => $card !== null,
                'reason' => $card === null ? __('No card could be chosen from the votes.') : null,
            ];
        });

        return Response::structured($result);
    }

    /**
     * The card the game preselects after a reveal (spec 4 §3 step 6).
     */
    private function suggestedCard(PokerRound $round, PokerGame $game): ?string
    {
        $result = PokerResult::for($round, $game);

        if ($game->isNumeric()) {
            return $result['nearestCard'];
        }

        return count($result['mode']) === 1 ? $result['mode'][0] : null;
    }
}
