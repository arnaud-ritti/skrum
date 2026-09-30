<?php

namespace App\Models;

use Database\Factories\RetroThemeFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

/**
 * @property string $id
 * @property string $retro_id
 * @property string $name
 * @property int $position
 */
#[Fillable(['name', 'position'])]
class RetroTheme extends Model
{
    /** @use HasFactory<RetroThemeFactory> */
    use HasFactory;

    use HasUuids;

    /** @return BelongsTo<Retro, $this> */
    public function retro(): BelongsTo
    {
        return $this->belongsTo(Retro::class);
    }

    /** @return BelongsToMany<Card, $this> */
    public function cards(): BelongsToMany
    {
        return $this->belongsToMany(Card::class, 'retro_theme_cards', 'theme_id', 'card_id');
    }

    protected function casts(): array
    {
        return ['position' => 'integer'];
    }
}
