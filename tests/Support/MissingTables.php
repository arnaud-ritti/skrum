<?php

namespace Tests\Support;

use Closure;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;

class MissingTables
{
    /**
     * Runs the closure while no table can be found, without any DDL: the connection looks
     * for every table under a prefix that does not exist. The nested transaction is rolled
     * back afterwards, which also clears the aborted state PostgreSQL is left in.
     */
    public static function during(Closure $callback): mixed
    {
        $connection = DB::connection();
        $prefix = $connection->getTablePrefix();

        DB::beginTransaction();
        $connection->setTablePrefix('missing_');

        try {
            return $callback();
        } finally {
            $connection->setTablePrefix($prefix);
            DB::rollBack();
        }
    }

    /**
     * Runs the closure while the table of one model cannot be found and every other table can:
     * the queries of that model look for a table that does not exist. Still no DDL.
     *
     * @param  class-string<Model>  $model
     */
    public static function ofModel(string $model, Closure $callback): mixed
    {
        $hidden = true;

        $model::addGlobalScope('missing-table', function (Builder $query) use (&$hidden): void {
            if ($hidden) {
                $query->from('missing_'.$query->getModel()->getTable());
            }
        });

        DB::beginTransaction();

        try {
            return $callback();
        } finally {
            $hidden = false;
            DB::rollBack();
        }
    }
}
