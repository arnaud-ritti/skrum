<?php

namespace App\Models;

use Database\Factories\WhiteboardVersionFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * The live scene of a board at one moment, as stored. A null name means the
 * version was stored automatically (spec §9).
 *
 * @phpstan-type VersionScene array{elements: list<array<string, mixed>>, fileIds: list<string>}
 *
 * @property string $id
 * @property string $whiteboard_id
 * @property string|null $name
 * @property VersionScene $scene
 * @property int $seq
 * @property string|null $created_by_member_id
 * @property Carbon $created_at
 * @property-read Whiteboard $whiteboard
 * @property-read WhiteboardMember|null $createdBy
 */
#[Fillable(['whiteboard_id', 'name', 'scene', 'seq', 'created_by_member_id'])]
class WhiteboardVersion extends Model
{
    /** @use HasFactory<WhiteboardVersionFactory> */
    use HasFactory;

    use HasUuids;

    public const UPDATED_AT = null;

    public const MaxNamed = 100;

    public const KeptAutomatic = 50;

    /** @return BelongsTo<Whiteboard, $this> */
    public function whiteboard(): BelongsTo
    {
        return $this->belongsTo(Whiteboard::class);
    }

    /** @return BelongsTo<WhiteboardMember, $this> */
    public function createdBy(): BelongsTo
    {
        return $this->belongsTo(WhiteboardMember::class, 'created_by_member_id');
    }

    public function isAutomatic(): bool
    {
        return $this->name === null;
    }

    protected function casts(): array
    {
        return [
            'scene' => 'array',
            'seq' => 'integer',
        ];
    }
}
