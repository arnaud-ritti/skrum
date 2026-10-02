<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /** @var array<string, string> */
    private const array ThemeColorOf = [
        'green' => 'moss',
        'red' => 'coral',
        'blue' => 'sky',
        'amber' => 'sun',
        'purple' => 'plum',
        'slate' => 'iris',
    ];

    public function up(): void
    {
        foreach (['columns', 'workspace_template_columns'] as $table) {
            foreach (self::ThemeColorOf as $oldColor => $themeColor) {
                DB::table($table)->where('color', $oldColor)->update(['color' => $themeColor]);
            }
        }
    }
};
