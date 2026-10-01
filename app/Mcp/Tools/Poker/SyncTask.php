<?php

namespace App\Mcp\Tools\Poker;

use App\Actions\Integrations\PokerTaskSync;
use App\Actions\Integrations\RequestEstimateSync;
use App\Actions\Integrations\ResolvePokerTracker;
use App\Enums\McpScope;
use App\Mcp\McpContext;
use App\Mcp\McpFeature;
use App\Mcp\Tools\SkrumTool;
use App\Models\PokerGame;
use App\Models\PokerTask;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Laravel\Mcp\Request;
use Laravel\Mcp\Response;
use Laravel\Mcp\ResponseFactory;
use Laravel\Mcp\Server\Tools\Annotations\IsOpenWorld;
use Laravel\Mcp\Server\Tools\Annotations\IsReadOnly;

#[IsReadOnly(false)]
#[IsOpenWorld]
class SyncTask extends SkrumTool
{
    protected string $name = 'poker.game.task.sync';

    protected string $description = 'Write the estimate of an imported task back to its tracker again (facilitator only): retries a failed write-back or forces a rewrite of the current estimate. The estimate itself cannot be changed with this tool.';

    public function __construct(
        private McpContext $context,
        private ResolvePokerTracker $resolvePokerTracker,
        private RequestEstimateSync $requestEstimateSync,
    ) {}

    public function schema(JsonSchema $schema): array
    {
        return [
            'task_id' => $schema->string()->format('uuid')->required(),
        ];
    }

    protected function requiredScope(): McpScope
    {
        return McpScope::Write;
    }

    protected function requiredFeature(): ?McpFeature
    {
        return McpFeature::Trackers;
    }

    protected function run(Request $request): Response|ResponseFactory
    {
        $validated = $request->validate(['task_id' => ['required', 'uuid']]);

        $task = PokerTask::query()
            ->whereKey($validated['task_id'])
            ->whereHas('game', fn ($query) => $query->whereIn('team_id', $this->context->visibleTeamIds()))
            ->firstOrFail();
        $game = $task->game;

        if (! $this->resolvePokerTracker->teamHasTracker($game->team)) {
            throw ValidationException::withMessages(['task_id' => __('This team has no connected tracker.')]);
        }

        $player = $this->context->pokerPlayer($game) ?? throw new AuthorizationException(__('Only the facilitator can do this.'));

        DB::transaction(function () use ($game, $task, $player): void {
            $locked = PokerGame::query()->whereKey($game->id)->lockForUpdate()->firstOrFail();
            $lockedTask = PokerTask::query()->where('poker_game_id', $locked->id)->whereKey($task->id)->firstOrFail();

            $this->requestEstimateSync->retryAndBroadcast($locked, $lockedTask, $player);
        });

        return Response::structured(['syncState' => PokerTaskSync::Pending]);
    }
}
