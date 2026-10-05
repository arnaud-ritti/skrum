<?php

namespace App\Actions\ActionItems;

use App\Enums\ActionItemPriority;
use App\Models\Team;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Str;

class ActionItemFilters
{
    /**
     * Single status values, as MCP takes them and as older links and stored filters
     * carry them: `open` is "not done", `overdue` is "not done and late".
     */
    public const Statuses = ['open', 'doing', 'overdue', 'completed', 'all'];

    public const StatusTokens = ['todo', 'doing', 'completed'];

    public const DefaultStatuses = ['todo', 'doing'];

    public const DueBuckets = ['overdue', 'today', 'week', 'later', 'none'];

    public const Sources = ['retro', 'outside'];

    public const SearchMaxLength = 100;

    /**
     * @param  array<int, string>  $statuses  StatusTokens, canonical order
     * @param  array<int, string>  $priorities  priority values, canonical order; empty is every priority
     * @param  ?string  $search  the topbar search, trimmed, cut at SearchMaxLength
     */
    public function __construct(
        public array $statuses = self::DefaultStatuses,
        public ?string $assignee = null,
        public ?string $teamId = null,
        public ?string $itemId = null,
        public array $priorities = [],
        public ?string $due = null,
        public ?string $source = null,
        public ?string $search = null,
    ) {}

    /**
     * @param  Collection<int, Team>  $visibleTeams
     */
    public static function fromRequest(Request $request, Collection $visibleTeams): self
    {
        return self::fromQuery($request->query(), $visibleTeams);
    }

    /**
     * The page's parameters as an array: the request's query, or the `filters` of an "all
     * matching" bulk request. Unknown values fall back to the defaults instead of failing; a
     * team the viewer cannot see is ignored, as on the page.
     *
     * @param  array<array-key, mixed>  $query
     * @param  Collection<int, Team>  $visibleTeams
     */
    public static function fromQuery(array $query, Collection $visibleTeams): self
    {
        $team = $query['team'] ?? null;
        $item = $query['item'] ?? null;
        [$statuses, $statusDue] = self::readStatus($query['status'] ?? null);

        return new self(
            statuses: $statuses,
            assignee: self::assignee($query['assignee'] ?? null),
            teamId: is_string($team) && $visibleTeams->contains('id', $team) ? $team : null,
            itemId: is_string($item) && Str::isUuid($item) ? $item : null,
            priorities: self::many($query['priority'] ?? null, self::priorityValues()),
            due: self::one($query['due'] ?? null, self::DueBuckets) ?? $statusDue,
            source: self::one($query['source'] ?? null, self::Sources),
            search: self::search($query['q'] ?? null),
        );
    }

    /**
     * One of `Statuses`, as MCP sends it.
     */
    public static function forStatus(string $status, ?string $assignee = null): self
    {
        [$statuses, $due] = self::readStatus($status);

        return new self(statuses: $statuses, assignee: self::assignee($assignee), due: $due);
    }

    public function hasEveryStatus(): bool
    {
        return count($this->statuses) === count(self::StatusTokens);
    }

    /**
     * @return array{
     *     status: array<int, string>,
     *     priority: array<int, string>,
     *     due: ?string,
     *     source: ?string,
     *     q: ?string,
     *     assignee: ?string,
     *     team: ?string,
     *     item: ?string
     * }
     */
    public function toArray(): array
    {
        return [
            'status' => $this->statuses,
            'priority' => $this->priorities,
            'due' => $this->due,
            'source' => $this->source,
            'q' => $this->search,
            'assignee' => $this->assignee,
            'team' => $this->teamId,
            'item' => $this->itemId,
        ];
    }

    /**
     * @return array{0: array<int, string>, 1: ?string} the statuses and the due bucket a status value stands for
     */
    private static function readStatus(mixed $value): array
    {
        return match ($value) {
            'open' => [self::DefaultStatuses, null],
            'overdue' => [self::DefaultStatuses, 'overdue'],
            'all' => [self::StatusTokens, null],
            default => [self::many($value, self::StatusTokens) ?: self::DefaultStatuses, null],
        };
    }

    /**
     * The known values of a comma list, once each, in the order of $known.
     *
     * @param  array<int, string>  $known
     * @return array<int, string>
     */
    private static function many(mixed $value, array $known): array
    {
        if (! is_string($value)) {
            return [];
        }

        $given = explode(',', $value);

        return array_values(array_filter($known, fn (string $candidate): bool => in_array($candidate, $given, true)));
    }

    /**
     * @param  array<int, string>  $known
     */
    private static function one(mixed $value, array $known): ?string
    {
        return is_string($value) && in_array($value, $known, true) ? $value : null;
    }

    /**
     * @return array<int, string>
     */
    private static function priorityValues(): array
    {
        return array_map(fn (ActionItemPriority $priority): string => $priority->value, ActionItemPriority::cases());
    }

    private static function search(mixed $value): ?string
    {
        if (! is_string($value)) {
            return null;
        }

        $term = trim(mb_substr(trim($value), 0, self::SearchMaxLength));

        return $term === '' ? null : $term;
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
