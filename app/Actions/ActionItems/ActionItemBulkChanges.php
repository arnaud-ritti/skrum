<?php

namespace App\Actions\ActionItems;

use App\Models\ActionItem;
use App\Models\User;
use App\Models\Workspace;
use Closure;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\HttpException;
use Throwable;

/**
 * Spec 24 §5 rules 1 and 2: a bulk change is the single-item change applied to each item in
 * turn, each in its own transaction under its own lock, so that a refused item leaves the
 * others changed. The transactions broadcast, so they are not retried. An unexpected
 * failure of one item (a lock timeout, a deadlock) is reported and refused like the others,
 * so that the answer still lists what changed.
 */
class ActionItemBulkChanges
{
    public const MatchingCap = 500;

    public const FilterKeys = ['status', 'priority', 'due', 'source', 'q', 'assignee', 'team'];

    public function __construct(
        private ActionItemQuery $actionItemQuery,
        private ApplyActionItemChanges $applyActionItemChanges,
        private DeleteActionItem $deleteActionItem,
    ) {}

    /**
     * Spec 24 §5 rule 7: the items the filters match for the viewer now, in the order of the
     * list. Refused above the cap, and when they are not as many as the viewer confirmed, so
     * that nothing is changed on a set the viewer did not see.
     *
     * @param  array<string, mixed>  $query  page parameters among FilterKeys
     * @return array<int, string>
     *
     * @throws ValidationException
     */
    public function matching(User $user, Workspace $workspace, array $query, int $confirmedCount): array
    {
        $filters = ActionItemFilters::fromQuery($query, $workspace->teamsVisibleTo($user));
        $ids = ActionItemQuery::order($this->actionItemQuery->filter($this->actionItemQuery->visibleTo($user, $workspace), $user, $filters))
            ->limit(self::MatchingCap + 1)
            ->pluck('action_items.id')
            ->map(fn (mixed $id): string => (string) $id)
            ->all();

        if (count($ids) > self::MatchingCap) {
            throw ValidationException::withMessages([
                'filters' => __('More than :cap action items match. Narrow the filters.', ['cap' => self::MatchingCap]),
            ]);
        }

        if (count($ids) !== $confirmedCount) {
            throw ValidationException::withMessages([
                'count' => __('The list changed: :count action items match now.', ['count' => count($ids)]),
            ]);
        }

        return $ids;
    }

    /**
     * @param  array<int, string>  $ids
     * @param  array<string, mixed>  $changes  validated like ActionItemRules::update(allowsGuests: false)
     * @return array{changed: array<int, ActionItem>, refused: array<int, array{id: string, title: ?string, message: string}>}
     */
    public function update(User $user, Workspace $workspace, array $ids, array $changes): array
    {
        $actor = ActionItemActor::forUser($user);

        return $this->each($user, $workspace, $ids, fn (string $id): ActionItem => DB::transaction(
            fn (): ActionItem => $this->applyActionItemChanges->handle(WorkspaceActionItemGuard::lockWritable($id), $actor, $changes),
        ));
    }

    /**
     * @param  array<int, string>  $ids
     * @return array{changed: array<int, string>, refused: array<int, array{id: string, title: ?string, message: string}>}
     */
    public function delete(User $user, Workspace $workspace, array $ids): array
    {
        $actor = ActionItemActor::forUser($user);

        return $this->each($user, $workspace, $ids, function (string $id) use ($actor): string {
            DB::transaction(fn () => $this->deleteActionItem->handle(WorkspaceActionItemGuard::lockWritable($id), $actor));

            return $id;
        });
    }

    /**
     * An item the viewer cannot see reads as one that is gone, without a title: nothing tells
     * them it exists. A visible item's refusal carries its text, for a list the page may not hold.
     * Ids are lower-cased because the uuid rule accepts upper case while the stored keys are not.
     *
     * @template TChanged
     *
     * @param  array<int, string>  $ids
     * @param  Closure(string): TChanged  $change
     * @return array{changed: array<int, TChanged>, refused: array<int, array{id: string, title: ?string, message: string}>}
     */
    private function each(User $user, Workspace $workspace, array $ids, Closure $change): array
    {
        $ids = array_map(strtolower(...), $ids);
        $titles = $this->actionItemQuery->visibleTo($user, $workspace)->whereKey($ids)->pluck('content', 'id')->all();
        $changed = [];
        $refused = [];

        foreach ($ids as $id) {
            if (! array_key_exists($id, $titles)) {
                $refused[] = ['id' => $id, 'title' => null, 'message' => __('This action item no longer exists.')];

                continue;
            }

            try {
                $changed[] = $change($id);
            } catch (AuthorizationException|ValidationException|HttpException|ModelNotFoundException $exception) {
                $refused[] = [
                    'id' => $id,
                    'title' => $exception instanceof ModelNotFoundException ? null : (string) $titles[$id],
                    'message' => $this->reason($exception),
                ];
            } catch (Throwable $exception) {
                report($exception);

                $refused[] = ['id' => $id, 'title' => (string) $titles[$id], 'message' => __('This action item could not be changed. Try again.')];
            }
        }

        return ['changed' => $changed, 'refused' => $refused];
    }

    private function reason(Throwable $exception): string
    {
        if ($exception instanceof ValidationException) {
            return (string) collect($exception->errors())->flatten()->first();
        }

        if ($exception instanceof ModelNotFoundException) {
            return __('This action item no longer exists.');
        }

        return $exception->getMessage();
    }
}
