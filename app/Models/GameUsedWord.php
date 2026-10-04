<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\WithoutIncrementing;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;

/**
 * A word already drawn for a team in a locale. The table's key is the three columns together:
 * rows are inserted, read and deleted in bulk, never updated or deleted one by one.
 *
 * @property string $team_id
 * @property string $locale
 * @property string $word
 * @property Carbon|null $created_at
 */
#[Fillable(['team_id', 'locale', 'word'])]
#[WithoutIncrementing]
class GameUsedWord extends Model
{
    public const UPDATED_AT = null;

    protected $primaryKey;
}
