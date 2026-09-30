<?php

namespace App\Models;

use Database\Factories\ActionItemFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property string $id
 * @property string $retro_id
 * @property string $content
 * @property string|null $assignee_participant_id
 * @property string $created_by_participant_id
 * @property bool $is_done
 * @property string|null $theme_id
 * @property string|null $theme_name
 * @property-read Participant|null $assignee
 */
#[Fillable(['content', 'assignee_participant_id', 'created_by_participant_id', 'is_done', 'theme_id', 'theme_name'])]
class ActionItem extends Model
{
    /** @use HasFactory<ActionItemFactory> */
    use HasFactory;

    use HasUuids;

    /** @return BelongsTo<Retro, $this> */
    public function retro(): BelongsTo
    {
        return $this->belongsTo(Retro::class);
    }

    /** @return BelongsTo<Participant, $this> */
    public function assignee(): BelongsTo
    {
        return $this->belongsTo(Participant::class, 'assignee_participant_id');
    }

    /** @return BelongsTo<Participant, $this> */
    public function createdBy(): BelongsTo
    {
        return $this->belongsTo(Participant::class, 'created_by_participant_id');
    }

    protected function casts(): array
    {
        return [
            'is_done' => 'boolean',
        ];
    }
}
