<?php

namespace App\Support\Teams;

use App\Models\Team;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Str;

/**
 * A team's short address, unique in its workspace: lower-case letters and digits in groups
 * joined by single hyphens, derived from the team's name.
 */
class TeamSlug
{
    public const int MaxLength = 50;

    public const int MinLength = 2;

    public const string Pattern = '/^[a-z0-9]+(-[a-z0-9]+)*$/';

    public const string Fallback = 'team';

    public static function fromName(string $name): string
    {
        $slug = self::cut(Str::slug($name), self::MaxLength);

        if (strlen($slug) < self::MinLength) {
            return self::Fallback;
        }

        return $slug;
    }

    /** @param array<int, string> $taken */
    public static function firstFree(string $base, array $taken): string
    {
        if (! in_array($base, $taken, true)) {
            return $base;
        }

        $number = 2;

        while (in_array(self::numbered($base, $number), $taken, true)) {
            $number++;
        }

        return self::numbered($base, $number);
    }

    public static function availableIn(string $workspaceId, string $base, ?string $exceptTeamId = null): string
    {
        /** @var array<int, string> $taken */
        $taken = Team::query()
            ->where('workspace_id', $workspaceId)
            ->when($exceptTeamId !== null, fn (Builder $query): Builder => $query->whereKeyNot($exceptTeamId))
            ->pluck('slug')
            ->all();

        return self::firstFree($base, $taken);
    }

    private static function numbered(string $base, int $number): string
    {
        $suffix = "-{$number}";

        return self::cut($base, self::MaxLength - strlen($suffix)).$suffix;
    }

    private static function cut(string $slug, int $length): string
    {
        if (strlen($slug) <= $length) {
            return $slug;
        }

        $cut = substr($slug, 0, $length);
        $lastHyphen = strrpos($cut, '-');

        if ($lastHyphen !== false && $lastHyphen >= self::MinLength) {
            return substr($cut, 0, $lastHyphen);
        }

        return rtrim($cut, '-');
    }
}
