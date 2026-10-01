<?php

namespace App\Models;

use Database\Factories\WhiteboardElementFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property string $id
 * @property string $whiteboard_id
 * @property string $element_id
 * @property string $type
 * @property array<string, mixed> $data
 * @property int $version
 * @property int $version_nonce
 * @property string|null $author_member_id
 * @property bool $is_sticky
 * @property bool $is_deleted
 * @property int $seq
 */
#[Fillable(['whiteboard_id', 'element_id', 'type', 'data', 'version', 'version_nonce', 'author_member_id', 'is_sticky', 'is_deleted', 'seq'])]
class WhiteboardElement extends Model
{
    /** @use HasFactory<WhiteboardElementFactory> */
    use HasFactory;

    use HasUuids;

    /** @return BelongsTo<Whiteboard, $this> */
    public function whiteboard(): BelongsTo
    {
        return $this->belongsTo(Whiteboard::class);
    }

    protected function casts(): array
    {
        return [
            'data' => 'array',
            'version' => 'integer',
            'version_nonce' => 'integer',
            'is_sticky' => 'boolean',
            'is_deleted' => 'boolean',
            'seq' => 'integer',
        ];
    }
}
