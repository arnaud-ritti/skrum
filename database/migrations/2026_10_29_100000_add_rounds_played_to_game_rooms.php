<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * The rounds a room ended, kept as a counter because the oldest rounds are pruned. Existing rooms
     * start from the rounds still stored.
     */
    public function up(): void
    {
        Schema::table('game_rooms', function (Blueprint $table): void {
            $table->unsignedInteger('rounds_played')->default(0);
        });

        DB::table('game_rooms')->select('id')->chunkById(500, function (Collection $rooms): void {
            foreach ($rooms as $room) {
                DB::table('game_rooms')->where('id', $room->id)->update([
                    'rounds_played' => DB::table('game_rounds')->where('game_room_id', $room->id)->whereNotNull('ended_at')->count(),
                ]);
            }
        });
    }
};
