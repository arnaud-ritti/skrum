<?php

namespace App\Actions\Integrations;

use App\Actions\ActionItems\ActionItemActor;
use App\Actions\ActionItems\ExternalSyncActor;
use App\Enums\ActionItemEventOrigin;
use App\Models\ActionItem;
use App\Models\PokerTask;
use App\Models\Retro;

/**
 * The `data` of each automatic event (spec 8 §4.7), built when the event
 * happens. Action items are always named; guest actors, votes, players,
 * comments, sub-tasks and emails are never sent.
 */
class BuildWebhookEventData
{
    public function __construct(private BuildRetroRecap $buildRetroRecap) {}

    /**
     * @return array<string, mixed>
     */
    public function retroCompleted(Retro $retro): array
    {
        return [...$this->buildRetroRecap->content($retro)->toWebhook(), 'retro' => ['id' => $retro->id]];
    }

    /**
     * @return array{actionItem: array<string, mixed>}
     */
    public function actionItemCreated(ActionItem $item): array
    {
        return ['actionItem' => $this->actionItem($item, null)];
    }

    /**
     * @return array{actionItem: array<string, mixed>, origin: string, completedVia: array{source: string, key: string}|null}
     */
    public function actionItemStatusChanged(ActionItem $item, ActionItemEventOrigin $origin, ActionItemActor|ExternalSyncActor|null $actor): array
    {
        $completedBy = $item->isCompleted() && $actor instanceof ActionItemActor ? $actor->user?->name : null;

        return [
            'actionItem' => $this->actionItem($item, $completedBy),
            'origin' => $origin->value,
            'completedVia' => $actor instanceof ExternalSyncActor ? ['source' => $actor->source, 'key' => $actor->key] : null,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function pokerTaskEstimated(PokerTask $task): array
    {
        $game = $task->game;
        $gameUrl = route('poker.show', $game);

        return [
            'game' => ['id' => $game->id, 'title' => $game->title, 'url' => $gameUrl],
            'task' => [
                'id' => $task->id,
                'title' => $task->title,
                'url' => $gameUrl,
                'estimate' => $task->estimate,
                'deckName' => $game->deckLabel(),
                'external' => $task->external_source === null ? null : [
                    'source' => $task->external_source,
                    'key' => $task->external_key,
                    'url' => $task->external_url,
                ],
            ],
            'estimatedAt' => ($task->estimated_at ?? now())->toIso8601ZuluString(),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function actionItem(ActionItem $item, ?string $completedBy): array
    {
        $item->loadMissing(['team.workspace', 'retro', 'author', 'assigneeUser', 'assigneeParticipant.user']);
        $retro = $item->retro;
        $assignee = $this->buildRetroRecap->assignee($item, forMachines: true);

        return [
            'id' => $item->id,
            'content' => $item->content,
            'status' => $item->isCompleted() ? 'completed' : 'open',
            'assignee' => $assignee === null ? null : ['name' => $assignee],
            'createdBy' => $item->author === null ? null : ['name' => $item->author->name],
            'completedBy' => $completedBy === null ? null : ['name' => $completedBy],
            'dueOn' => $item->due_on?->toDateString(),
            'priority' => $item->priority->value,
            'completedAt' => $item->completed_at?->toIso8601ZuluString(),
            'url' => route('workspaces.actionItems.index', [
                'workspace' => $item->team->workspace,
                'team' => $item->team_id,
                'item' => $item->id,
            ]),
            'retro' => $retro === null ? null : ['id' => $retro->id, 'title' => $retro->title, 'url' => route('retros.show', $retro)],
            'themeName' => $item->theme_name,
            'createdAt' => $item->created_at?->toIso8601ZuluString(),
        ];
    }
}
