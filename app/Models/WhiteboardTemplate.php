<?php

namespace App\Models;

use App\Actions\Whiteboards\CopyWhiteboardScene;
use App\Actions\Whiteboards\PresentWhiteboardPreview;
use App\Support\Database\NameKey;
use Database\Factories\WhiteboardTemplateFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Facades\Storage;

/**
 * A scene saved from a board for the whole workspace. Boards copy it, images
 * included, so changing or deleting it never changes a board.
 *
 * @phpstan-import-type Scene from CopyWhiteboardScene
 * @phpstan-import-type Preview from PresentWhiteboardPreview
 *
 * @property string $id
 * @property string $workspace_id
 * @property string $name
 * @property string $name_key
 * @property string|null $description
 * @property Scene $scene
 * @property Preview $preview
 * @property string|null $created_by_user_id
 * @property-read Workspace $workspace
 */
#[Fillable(['name', 'description', 'scene', 'preview', 'created_by_user_id'])]
class WhiteboardTemplate extends Model
{
    /** @use HasFactory<WhiteboardTemplateFactory> */
    use HasFactory;

    use HasUuids;

    public const StorageRoot = 'whiteboard-templates';

    protected static function booted(): void
    {
        static::deleted(function (WhiteboardTemplate $template): void {
            Storage::deleteDirectory($template->storageDirectory());
        });
    }

    /** @return BelongsTo<Workspace, $this> */
    public function workspace(): BelongsTo
    {
        return $this->belongsTo(Workspace::class);
    }

    public function storageDirectory(): string
    {
        return self::StorageRoot."/{$this->id}";
    }

    /**
     * The key always follows the name: no caller sets it.
     *
     * @return Attribute<string, string>
     */
    protected function name(): Attribute
    {
        return Attribute::make(
            set: fn (string $name): array => ['name' => $name, 'name_key' => NameKey::of($name)],
        );
    }

    protected function casts(): array
    {
        return [
            'scene' => 'array',
            'preview' => 'array',
        ];
    }
}
