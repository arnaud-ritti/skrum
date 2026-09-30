<?php

namespace App\Actions\ActionItems;

use App\Models\Team;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Str;

class ActionItemFilters
{
    public const Statuses = ['open', 'overdue', 'completed', 'all'];

    public function __construct(
        public string $status = 'open',
        public ?string $assignee = null,
        public ?string $teamId = null,
        public ?string $itemId = null,
    ) {}

    /**
     * Unknown values fall back to the defaults instead of failing.
     *
     * @param  Collection<int, Team>  $visibleTeams
     */
    public static function fromRequest(Request $request, Collection $visibleTeams): self
    {
        $status = $request->query('status');
        $team = $request->query('team');
        $item = $request->query('item');

        return new self(
            status: is_string($status) && in_array($status, self::Statuses, true) ? $status : 'open',
            assignee: self::assignee($request->query('assignee')),
            teamId: is_string($team) && $visibleTeams->contains('id', $team) ? $team : null,
            itemId: is_string($item) && Str::isUuid($item) ? $item : null,
        );
    }

    /**
     * @return array{
     *     status: string,
     *     assignee: ?string,
     *     team: ?string,
     *     item: ?string
     * }
     */
    public function toArray(): array
    {
        return [
            'status' => $this->status,
            'assignee' => $this->assignee,
            'team' => $this->teamId,
            'item' => $this->itemId,
        ];
    }

    private static function assignee(mixed $value): ?string
    {
        if (! is_string($value)) {
            return null;
        }

        if (in_array($value, ['me', 'unassigned'], true)) {
            return $value;
        }

        return Str::isUuid($value) ? $value : null;
    }
}
