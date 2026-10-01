<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('whiteboards', function (Blueprint $table) {
            $table->unsignedBigInteger('last_versioned_seq')->default(0);
        });

        DB::table('whiteboards')->update(['last_versioned_seq' => DB::raw('seq')]);

        Schema::create('whiteboard_versions', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('whiteboard_id')->constrained()->cascadeOnDelete();
            $table->string('name', 80)->nullable();
            $table->json('scene');
            $table->unsignedBigInteger('seq');
            $table->foreignUuid('created_by_member_id')->nullable()->constrained('whiteboard_members')->nullOnDelete();
            $table->timestamp('created_at')->nullable();

            $table->index(['whiteboard_id', 'created_at']);
        });
    }
};
