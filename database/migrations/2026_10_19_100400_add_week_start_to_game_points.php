<?php

use Carbon\CarbonImmutable;
use Carbon\CarbonInterface;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * The Monday (UTC) of the week a row was created in, stored so that streaks group by a plain column.
     */
    public function up(): void
    {
        Schema::table('game_points', function (Blueprint $table): void {
            $table->date('week_start')->nullable();
        });

        DB::table('game_points')->select(['id', 'created_at'])->lazyById(500)->each(
            fn (object $point) => DB::table('game_points')->where('id', $point->id)->update([
                'week_start' => CarbonImmutable::parse((string) $point->created_at, 'UTC')->startOfWeek(CarbonInterface::MONDAY)->toDateString(),
            ]),
        );

        Schema::table('game_points', function (Blueprint $table): void {
            $table->date('week_start')->nullable(false)->change();
            $table->index(['team_id', 'user_id', 'week_start']);
        });
    }
};
