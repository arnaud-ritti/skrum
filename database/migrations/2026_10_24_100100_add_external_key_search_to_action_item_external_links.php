<?php

use App\Support\Database\SearchText;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Off, so that no table stays locked while its rows are filled. The work can then stop midway:
     * up() adds only what is missing and can be run again.
     */
    public $withinTransaction = false;

    /**
     * The folded ticket key the action items search reads (plan 24, P24-07), as the earlier
     * search-column migrations do. Existing links are filled here, one update per link to fill.
     */
    public function up(): void
    {
        if (! Schema::hasColumn('action_item_external_links', 'external_key_search')) {
            Schema::table('action_item_external_links', function (Blueprint $table): void {
                $table->text('external_key_search')->nullable();
            });
        }

        DB::table('action_item_external_links')
            ->select(['id', 'external_key'])
            ->whereNull('external_key_search')
            ->lazyById(500)
            ->each(fn (object $row) => DB::table('action_item_external_links')
                ->where('id', $row->id)
                ->update(['external_key_search' => SearchText::fold($row->external_key)]));
    }
};
