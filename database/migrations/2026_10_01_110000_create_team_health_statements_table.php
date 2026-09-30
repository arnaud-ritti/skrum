<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('team_health_statements', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('team_id')->constrained()->cascadeOnDelete();
            $table->string('builtin')->nullable();
            $table->string('text', 150)->nullable();
            $table->string('label', 30)->nullable();
            $table->unsignedSmallInteger('position');
            $table->timestamp('archived_at')->nullable();
            $table->timestamps();

            $table->unique(['team_id', 'builtin']);
        });

        if (DB::getDriverName() !== 'pgsql') {
            return;
        }

        DB::statement(<<<'SQL'
            alter table team_health_statements add constraint team_health_statements_builtin_or_custom check (
                (builtin is not null and text is null and label is null)
                or (builtin is null and text is not null and label is not null)
            )
            SQL);
    }
};
