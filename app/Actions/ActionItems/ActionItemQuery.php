<?php

namespace App\Actions\ActionItems;

use App\Models\ActionItem;
use App\Models\User;
use App\Models\Workspace;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Builder;

class ActionItemQuery
{
    public const PerPage = 50;

    /**
     * @return LengthAwarePaginator<int, ActionItem>
     */
    public function forUser(User $user, Workspace $workspace, ActionItemFilters $filters): LengthAwarePaginator
    {
        $query = $this->visibleTo($user, $workspace)
            ->with(ActionItem::presentationRelations())
            ->withCount('comments');

        return self::order($this->filter($query, $user, $filters))->paginate(self::PerPage)->withQueryString();
    }

    /**
     * @param  Builder<ActionItem>  $query
     * @return Builder<ActionItem>
     */
    public function filter(Builder $query, User $user, ActionItemFilters $filters): Builder
    {
        $this->filterByStatus($query, $filters->status);

        return $this->filterByScope($query, $user, $filters);
    }

    /**
     * Counts under the team and assignee filters, whatever the status filter.
     *
     * @return array{
     *     open: int,
     *     overdue: int,
     *     completed: int,
     *     mine: int,
     *     rituals: int
     * }
     */
    public function counts(User $user, Workspace $workspace, ActionItemFilters $filters): array
    {
        $today = ActionItem::today()->toDateString();
        $scoped = $this->filterByScope($this->visibleTo($user, $workspace), $user, $filters)->toBase();
        $open = (clone $scoped)->whereNull('completed_at');

        return [
            'open' => (clone $open)->count(),
            'overdue' => (clone $open)->whereNotNull('due_on')->where('due_on', '<', $today)->count(),
            'completed' => (clone $scoped)->whereNotNull('completed_at')->count(),
            'mine' => (clone $open)->where('assignee_user_id', $user->id)->count(),
            'rituals' => (clone $scoped)->distinct()->count('retro_id'),
        ];
    }

    /**
     * @param  Builder<ActionItem>  $query
     * @return Builder<ActionItem>
     */
    private function filterByScope(Builder $query, User $user, ActionItemFilters $filters): Builder
    {
        $this->filterByAssignee($query, $user, $filters->assignee);

        if ($filters->teamId !== null) {
            $query->where('team_id', $filters->teamId);
        }

        return $query;
    }

    public function find(User $user, Workspace $workspace, string $itemId): ?ActionItem
    {
        return $this->visibleTo($user, $workspace)
            ->with(ActionItem::presentationRelations())
            ->withCount('comments')
            ->find($itemId);
    }

    /**
     * Items of the workspace's teams the user can view: all of them for
     * Owners/Admins, their own teams for Members.
     *
     * @return Builder<ActionItem>
     */
    public function visibleTo(User $user, Workspace $workspace): Builder
    {
        $query = ActionItem::query()->whereIn('team_id', $workspace->teams()->select('id'));

        if ($user->canManage($workspace)) {
            return $query;
        }

        return $query->whereIn('team_id', $user->teams()->select('teams.id'));
    }

    /**
     * Open before completed; by due date (overdue ones are the earliest, undated ones last), then
     * priority; completed ones by completion, newest first. The first key is stored on the row
     * (ActionItem::sortRankFor), so every key is a plain column.
     *
     * @param  Builder<ActionItem>  $query
     * @return Builder<ActionItem>
     */
    public static function order(Builder $query): Builder
    {
        return $query
            ->orderBy('action_items.sort_rank')
            ->latest('action_items.completed_at')
            ->latest('action_items.created_at')
            ->orderBy('action_items.id');
    }

    /**
     * @param  Builder<ActionItem>  $query
     */
    private function filterByStatus(Builder $query, string $status): void
    {
        if ($status === 'all') {
            return;
        }

        if ($status === 'completed') {
            $query->whereNotNull('completed_at');

            return;
        }

        $query->whereNull('completed_at');

        if ($status === 'overdue') {
            $query->whereNotNull('due_on')->where('due_on', '<', ActionItem::today()->toDateString());
        }
    }

    /**
     * @param  Builder<ActionItem>  $query
     */
    private function filterByAssignee(Builder $query, User $user, ?string $assignee): void
    {
        if ($assignee === null) {
            return;
        }

        if ($assignee === 'unassigned') {
            $query->whereNull('assignee_user_id')->whereNull('assignee_participant_id');

            return;
        }

        $query->where('assignee_user_id', $assignee === 'me' ? $user->id : $assignee);
    }
}
