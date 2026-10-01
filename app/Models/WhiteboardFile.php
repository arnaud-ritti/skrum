<?php

namespace App\Models;

use Database\Factories\WhiteboardFileFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

/**
 * @property string $id
 * @property string $whiteboard_id
 * @property string $file_id
 * @property string $path
 * @property string $mime_type
 * @property int $size
 * @property string|null $uploaded_by_member_id
 */
#[Fillable(['whiteboard_id', 'file_id', 'path', 'mime_type', 'size', 'uploaded_by_member_id'])]
class WhiteboardFile extends Model
{
    /** @use HasFactory<WhiteboardFileFactory> */
    use HasFactory;

    use HasUuids;

    protected function casts(): array
    {
        return ['size' => 'integer'];
    }
}
