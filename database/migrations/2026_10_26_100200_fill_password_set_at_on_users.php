<?php

use Carbon\CarbonImmutable;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Each chunk commits on its own; a run that stopped resumes on the rows still without a date.
     *
     * @var bool
     */
    public $withinTransaction = false;

    /** An account whose first link came with it was created by single sign-on, with a password nobody knows. */
    private const int SameMomentSeconds = 60;

    public function up(): void
    {
        DB::table('users')->whereNull('password_set_at')->select(['id', 'created_at'])->chunkById(500, function (Collection $users): void {
            $firstLinks = DB::table('social_accounts')
                ->whereIn('user_id', $users->pluck('id')->all())
                ->select(['user_id', 'created_at'])
                ->get()
                ->groupBy('user_id')
                ->map(fn (Collection $links): ?string => $links->pluck('created_at')->filter()->map(fn (mixed $at): string => (string) $at)->sort()->first());

            foreach ($users as $user) {
                $createdAt = $user->created_at === null ? CarbonImmutable::now('UTC') : CarbonImmutable::parse((string) $user->created_at, 'UTC');
                $firstLink = $firstLinks->get($user->id);

                if ($firstLink !== null && abs(CarbonImmutable::parse($firstLink, 'UTC')->diffInSeconds($createdAt)) <= self::SameMomentSeconds) {
                    continue;
                }

                DB::table('users')->where('id', $user->id)->update(['password_set_at' => $createdAt->toDateTimeString()]);
            }
        });
    }
};
