<?php

namespace App\Models;

use App\Enums\ColumnColor;
use Database\Factories\WorkspaceTemplateColumnFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property string $id
 * @property string $workspace_template_id
 * @property string $title
 * @property string|null $description
 * @property ColumnColor $color
 * @property int $position
 */
#[Fillable(['title', 'description', 'color', 'position'])]
class WorkspaceTemplateColumn extends Model
{
    /** @use HasFactory<WorkspaceTemplateColumnFactory> */
    use HasFactory;

    use HasUuids;

    /** @return BelongsTo<WorkspaceTemplate, $this> */
    public function template(): BelongsTo
    {
        return $this->belongsTo(WorkspaceTemplate::class, 'workspace_template_id');
    }

    protected function casts(): array
    {
        return [
            'color' => ColumnColor::class,
            'position' => 'integer',
        ];
    }
}
