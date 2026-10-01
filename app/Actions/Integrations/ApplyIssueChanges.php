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

    public const PushClockFallbackMinutes = 10;

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
            /** @var array{pushes: array<int, string>, changed: bool} $outcome */
            $outcome = DB::transaction(fn (): array => $this->applyToItem(
                $integration,
                (string) $itemId,
                $itemLinks->pluck('id')->all(),
                $issues,
                $complete,
                $sourceWins,
            ));

            foreach ($outcome['pushes'] as $linkId) {
                PushActionItemState::dispatch($linkId);
            }

            if (! $outcome['changed']) {
                continue;
            }

            $item = ActionItem::query()->find($itemId);

            if ($item !== null) {
                rescue(fn () => $this->broadcast->externalLinksChanged($item));
            }
        }
    }

    /**
     * An item has at most one link per source (unique index), so it is
     * decided once per read.
     *
     * @param  array<int, string>  $linkIds
     * @param  array<string, TrackerIssue>  $issues
     * @return array{pushes: array<int, string>, changed: bool} links whose skrum state won and must be pushed
     */
    private function applyToItem(TeamIntegration $integration, string $itemId, array $linkIds, array $issues, bool $complete, bool $sourceWins): array
    {
        $item = ActionItem::query()->whereKey($itemId)->lockForUpdate()->first();
        $outcome = ['pushes' => [], 'changed' => false];

        if ($item === null) {
            return $outcome;
        }

        foreach (ActionItemExternalLink::query()->whereKey($linkIds)->lockForUpdate()->get() as $link) {
            $issue = $issues[$link->external_id] ?? null;

            if ($issue === null) {
                if ($complete && $link->missing_at === null) {
                    $link->forceFill(['missing_at' => now()])->save();
                    $outcome['changed'] = true;
                }

                continue;
            }

            $status = $issue->issueStatus;

            if ($status === null) {
                $outcome['changed'] = $this->saveLink($link, ['missing_at' => null]) || $outcome['changed'];

                continue;
            }

            if ($this->isStale($link, $status->updatedAt)) {
                continue;
            }

            $state = DoneMapping::state($integration, $status);
            $itemState = $item->isCompleted() ? ExternalIssueState::Done : ExternalIssueState::Open;
            $echoesLastPush = $this->echoesLastPush($link, $state, $status->updatedAt);

            $outcome['changed'] = $this->saveLink($link, [
                'external_state' => $state,
                'external_status_name' => $issue->status,
                'external_updated_at' => $status->updatedAt,
                'missing_at' => null,
                ...($state === $itemState ? ['sync_error' => null] : []),
            ]) || $outcome['changed'];

            if ($state === $itemState) {
                continue;
            }

            $sourceWinsLink = $sourceWins && $link->last_pushed_at === null;

            if (! $sourceWinsLink && $this->skrumWins($link, $itemState, $status->updatedAt, $echoesLastPush)) {
                if ($this->canPush($integration, $link)) {
                    $outcome['pushes'][] = $link->id;
                }

                continue;
            }

            $item = $this->setActionItemStatus->handle(
                $item,
                new ExternalSyncActor($integration->provider->value, $link->external_key),
                $state === ExternalIssueState::Done ? ActionItemStatus::Completed : ActionItemStatus::Open,
            );
            $outcome['changed'] = true;
            $outcome['pushes'] = [...$outcome['pushes'], ...$this->markOtherTrackersChanged($item, $linkIds)];
        }

        return $outcome;
    }

    /**
     * Ruling: skrum is the hub between the trackers of one item, so a
     * change one source made is pushed to the item's other synced links
     * instead of each tracker flipping the item back.
     *
     * @param  array<int, string>  $appliedLinkIds
     * @return array<int, string> the links to push
     */
    private function markOtherTrackersChanged(ActionItem $item, array $appliedLinkIds): array
    {
        $pushes = [];
        $otherLinks = ActionItemExternalLink::query()
            ->where('action_item_id', $item->id)
            ->whereKeyNot($appliedLinkIds)
            ->lockForUpdate()
            ->get();

        foreach ($otherLinks as $link) {
            $integration = LinkStatusSync::integration($link, $item->team);

            if ($integration === null || ! $integration->isActive()) {
                continue;
            }

            $link->forceFill(['local_state_changed_at' => now(), 'sync_error' => null])->save();
            $pushes[] = $link->id;
        }

        return $pushes;
    }

    /**
     * Records a read on the link; true when what members see changed.
     *
     * @param  array<string, mixed>  $attributes
     */
    private function saveLink(ActionItemExternalLink $link, array $attributes): bool
    {
        $link->forceFill($attributes);
        $changed = $link->isDirty(['external_state', 'external_status_name', 'missing_at', 'sync_error']);
        $link->forceFill(['last_synced_at' => now()])->save();

        return $changed;
    }

    /**
     * A read fetched before a newer read or push was recorded must not
     * undo it. Without a source time the push time stands in, on skrum's
     * clock, so only while that push is recent.
     */
    private function isStale(ActionItemExternalLink $link, ?CarbonImmutable $sourceChangedAt): bool
    {
        if ($sourceChangedAt === null) {
            return false;
        }

        $recentPushAt = $link->last_pushed_at?->gte(now()->subMinutes(self::PushClockFallbackMinutes))
            ? $link->last_pushed_at
            : null;
        $known = $link->external_updated_at ?? $recentPushAt;

        return $known !== null && $sourceChangedAt->lt($known);
    }

    /**
     * The source reports exactly what skrum's last push left there, and
     * nothing newer: it has not changed since that push.
     */
    private function echoesLastPush(ActionItemExternalLink $link, ExternalIssueState $state, ?CarbonImmutable $sourceChangedAt): bool
    {
        if ($link->last_pushed_at === null || $link->last_pushed_state !== $state || $link->external_state !== $state) {
            return false;
        }

        return $sourceChangedAt === null
            || ($link->external_updated_at !== null && $sourceChangedAt->lte($link->external_updated_at));
    }

    /**
     * Decision 2: an unpushed skrum change (never pushed since, its push
     * failed, or the item changed while it was pushed) wins when it is at
     * least as recent as the source's change, when the source's change
     * time is unknown, or when the source only echoes skrum's last push.
     */
    private function skrumWins(ActionItemExternalLink $link, ExternalIssueState $itemState, ?CarbonImmutable $sourceChangedAt, bool $echoesLastPush): bool
    {
        $localChangedAt = $link->local_state_changed_at;

        if ($localChangedAt === null) {
            return false;
        }

        $unpushed = $link->last_pushed_at === null
            || $localChangedAt->gt($link->last_pushed_at)
            || $link->sync_error !== null
            || $link->last_pushed_state !== $itemState;

        if (! $unpushed) {
            return false;
        }

        return $echoesLastPush || $sourceChangedAt === null || $sourceChangedAt->lte($localChangedAt);
    }

    /**
     * A connection that cannot write already recorded why on the link;
     * pushing again on every read would only record it again.
     */
    private function canPush(TeamIntegration $integration, ActionItemExternalLink $link): bool
    {
        return $integration->canWrite() || $link->sync_error === null;
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
