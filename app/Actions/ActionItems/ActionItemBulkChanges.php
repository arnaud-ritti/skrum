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
 * others changed. The transactions broadcast, so they are not retried.
 */
class ActionItemBulkChanges
{
    public function __construct(
        private ActionItemQuery $actionItemQuery,
        private ApplyActionItemChanges $applyActionItemChanges,
        private DeleteActionItem $deleteActionItem,
    ) {}

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
     *
     * @template TChanged
     *
     * @param  array<int, string>  $ids
     * @param  Closure(string): TChanged  $change
     * @return array{changed: array<int, TChanged>, refused: array<int, array{id: string, title: ?string, message: string}>}
     */
    private function each(User $user, Workspace $workspace, array $ids, Closure $change): array
    {
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
