<?php

namespace App\Actions\ActionItems;

use App\Enums\ActionItemPriority;
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
        $this->filterByStatuses($query, $filters);
        $this->filterByDue($query, $filters->due);

        return $this->filterByScope($query, $user, $filters);
    }

    /**
     * Counts under the team, assignee, priority and source filters, whatever the status and the due date.
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
     * What the counters follow: everything but the status and the due date.
     *
     * @param  Builder<ActionItem>  $query
     * @return Builder<ActionItem>
     */
    private function filterByScope(Builder $query, User $user, ActionItemFilters $filters): Builder
    {
        $this->filterByAssignee($query, $user, $filters->assignee);

        if ($filters->teamId !== null) {
            $query->where('team_id', $filters->teamId);
        }

        if ($filters->priorities !== [] && count($filters->priorities) < count(ActionItemPriority::cases())) {
            $query->whereIn('priority', $filters->priorities);
        }

        if ($filters->source === 'retro') {
            $query->whereNotNull('retro_id');
        }

        if ($filters->source === 'outside') {
            $query->whereNull('retro_id');
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
    private function filterByStatuses(Builder $query, ActionItemFilters $filters): void
    {
        if ($filters->hasEveryStatus()) {
            return;
        }

        $query->where(function (Builder $query) use ($filters): void {
            foreach ($filters->statuses as $status) {
                $query->orWhere(function (Builder $query) use ($status): void {
                    if ($status === 'completed') {
                        $query->whereNotNull('completed_at');

                        return;
                    }

                    $query->whereNull('completed_at');

                    if ($status === 'doing') {
                        $query->whereNotNull('started_at');

                        return;
                    }

                    $query->whereNull('started_at');
                });
            }
        });
    }

    /**
     * Dates are compared as `Y-m-d` strings (docs/database.md rule 11).
     *
     * @param  Builder<ActionItem>  $query
     */
    private function filterByDue(Builder $query, ?string $due): void
    {
        if ($due === null) {
            return;
        }

        $today = ActionItem::today();
        $todayDate = $today->toDateString();
        $lastOfWeek = $today->addDays(6)->toDateString();

        if ($due === 'none') {
            $query->whereNull('due_on');

            return;
        }

        $query->whereNotNull('due_on');

        if ($due === 'overdue') {
            $query->whereNull('completed_at')->where('due_on', '<', $todayDate);

            return;
        }

        if ($due === 'today') {
            $query->where('due_on', $todayDate);

            return;
        }

        if ($due === 'week') {
            $query->where('due_on', '>=', $todayDate)->where('due_on', '<=', $lastOfWeek);

            return;
        }

        $query->where('due_on', '>', $lastOfWeek);
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
