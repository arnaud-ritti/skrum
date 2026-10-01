<?php

namespace App\Actions\Integrations;

use App\Actions\ActionItems\BroadcastActionItemChange;
use App\Actions\ActionItems\ExternalSyncActor;
use App\Actions\ActionItems\SetActionItemStatus;
use App\Actions\Poker\PresentPokerTask;
use App\Enums\ActionItemStatus;
use App\Enums\ExternalIssueState;
use App\Events\Poker\PokerGameChanged;
use App\Events\Poker\PokerTaskSaved;
use App\Jobs\Integrations\PushActionItemState;
use App\Models\ActionItem;
use App\Models\ActionItemExternalLink;
use App\Models\PokerGame;
use App\Models\PokerTask;
use App\Models\TeamIntegration;
use App\Support\Integrations\Trackers\DoneMapping;
use App\Support\Integrations\Trackers\TrackerIssue;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;

/**
 * Spec 8 §5.5, §5.7, §5.8: what a read returned becomes the links' source
 * state; items follow the source through the system actor (no permission,
 * lock or phase applies) unless an unpushed skrum change is at least as
 * recent, in which case skrum's state is pushed. Each item is applied
 * under its own row lock, then its links' locks.
 */
class ApplyIssueChanges
{
    public const BroadcastEachTaskUpTo = 10;

    public function __construct(
        private TrackedIssues $trackedIssues,
        private SetActionItemStatus $setActionItemStatus,
        private BroadcastActionItemChange $broadcast,
        private ApplyPokerTaskIssues $applyPokerTaskIssues,
        private PresentPokerTask $presentPokerTask,
    ) {}

    /**
     * @param  array<int, string>  $externalIds  the ids that were read
     * @param  array<string, TrackerIssue>  $issues  what the source returned for them
     * @param  bool  $complete  every id was asked for by itself, so an absent issue is gone
     * @param  bool  $sourceWins  the first read after sync was turned on (spec 8 §5.1)
     */
    public function handle(TeamIntegration $integration, array $externalIds, array $issues, bool $complete, bool $sourceWins = false): void
    {
        $ids = array_values(array_unique(array_map('strval', $externalIds)));

        if ($ids === []) {
            return;
        }

        $this->applyToActionItems($integration, $ids, $issues, $complete, $sourceWins);
        $this->applyToPokerTasks($integration, $ids, $issues, $complete);
    }

    /**
     * @param  array<int, string>  $ids
     * @param  array<string, TrackerIssue>  $issues
     */
    private function applyToActionItems(TeamIntegration $integration, array $ids, array $issues, bool $complete, bool $sourceWins): void
    {
        $links = $this->trackedIssues->links($integration)->whereIn('external_id', $ids)->get();

        foreach ($links->groupBy('action_item_id') as $itemId => $itemLinks) {
            /** @var array<int, string> $pushes */
            $pushes = DB::transaction(fn (): array => $this->applyToItem(
                $integration,
                (string) $itemId,
                $itemLinks->pluck('id')->all(),
                $issues,
                $complete,
                $sourceWins,
            ));

            foreach ($pushes as $linkId) {
                PushActionItemState::dispatch($linkId);
            }

            $item = ActionItem::query()->find($itemId);

            if ($item !== null) {
                rescue(fn () => $this->broadcast->externalLinksChanged($item));
            }
        }
    }

    /**
     * @param  array<int, string>  $linkIds
     * @param  array<string, TrackerIssue>  $issues
     * @return array<int, string> links whose skrum state won and must be pushed
     */
    private function applyToItem(TeamIntegration $integration, string $itemId, array $linkIds, array $issues, bool $complete, bool $sourceWins): array
    {
        $item = ActionItem::query()->whereKey($itemId)->lockForUpdate()->first();

        if ($item === null) {
            return [];
        }

        $pushes = [];

        foreach (ActionItemExternalLink::query()->whereKey($linkIds)->lockForUpdate()->get() as $link) {
            $issue = $issues[$link->external_id] ?? null;

            if ($issue === null || $issue->issueStatus === null) {
                if ($complete && $link->missing_at === null) {
                    $link->forceFill(['missing_at' => now()])->save();
                }

                continue;
            }

            $state = DoneMapping::state($integration, $issue->issueStatus);

            $link->forceFill([
                'external_state' => $state,
                'external_status_name' => $issue->status,
                'external_updated_at' => $issue->issueStatus->updatedAt,
                'last_synced_at' => now(),
                'missing_at' => null,
            ])->save();

            $itemState = $item->isCompleted() ? ExternalIssueState::Done : ExternalIssueState::Open;

            if ($state === $itemState) {
                continue;
            }

            if (! $sourceWins && $this->skrumWins($link, $issue->issueStatus->updatedAt)) {
                $pushes[] = $link->id;

                continue;
            }

            $item = $this->setActionItemStatus->handle(
                $item,
                new ExternalSyncActor($integration->provider->value, $link->external_key),
                $state === ExternalIssueState::Done ? ActionItemStatus::Completed : ActionItemStatus::Open,
            );
        }

        return $pushes;
    }

    /**
     * Decision 2: an unpushed skrum change (never pushed since, or its push
     * failed) wins when it is at least as recent as the source's change.
     */
    private function skrumWins(ActionItemExternalLink $link, ?CarbonImmutable $sourceChangedAt): bool
    {
        $localChangedAt = $link->local_state_changed_at;

        if ($localChangedAt === null) {
            return false;
        }

        $unpushed = $link->last_pushed_at === null
            || $localChangedAt->gt($link->last_pushed_at)
            || $link->sync_error !== null;

        return $unpushed && $sourceChangedAt !== null && $sourceChangedAt->lte($localChangedAt);
    }

    /**
     * @param  array<int, string>  $ids
     * @param  array<string, TrackerIssue>  $issues
     */
    private function applyToPokerTasks(TeamIntegration $integration, array $ids, array $issues, bool $complete): void
    {
        $tasks = $this->trackedIssues->tasks($integration)->whereIn('external_id', $ids)->get();

        foreach ($tasks->groupBy('poker_game_id') as $gameId => $gameTasks) {
            $game = PokerGame::query()->find($gameId);

            if ($game === null) {
                continue;
            }

            $this->announce($game, $this->applyPokerTaskIssues->handle($game, $gameTasks, $issues, $complete)['changed']);
        }
    }

    /**
     * @param  array<int, PokerTask>  $changed
     */
    private function announce(PokerGame $game, array $changed): void
    {
        if ($changed === []) {
            return;
        }

        if (count($changed) > self::BroadcastEachTaskUpTo) {
            rescue(fn () => broadcast(new PokerGameChanged($game->id)));

            return;
        }

        foreach ($changed as $task) {
            $task->loadCount('rounds');
            $payload = $this->presentPokerTask->handle($task);

            rescue(fn () => broadcast(new PokerTaskSaved($game->id, $payload)));
        }
    }
}
