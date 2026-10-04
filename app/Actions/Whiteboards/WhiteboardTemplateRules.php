<?php

namespace App\Actions\Whiteboards;

use App\Models\WhiteboardTemplate;
use App\Models\Workspace;
use App\Support\Database\NameKey;
use Illuminate\Validation\ValidationException;

/**
 * Both checks are made with the workspace row locked, inside the transaction
 * that writes the template, so two requests cannot pass them together.
 */
class WhiteboardTemplateRules
{
    public const MaxTemplates = 50;

    public static function ensureRoom(Workspace $lockedWorkspace): void
    {
        if ($lockedWorkspace->whiteboardTemplates()->count() < self::MaxTemplates) {
            return;
        }

        throw ValidationException::withMessages(['name' => __('This workspace already has :count whiteboard templates.', ['count' => self::MaxTemplates])]);
    }

    public static function ensureNameIsFree(Workspace $lockedWorkspace, string $name, ?WhiteboardTemplate $ignore = null): void
    {
        $isTaken = $lockedWorkspace->whiteboardTemplates()
            ->where('name_key', NameKey::of($name))
            ->when($ignore !== null, fn ($query) => $query->whereKeyNot($ignore?->id))
            ->exists();

        if (! $isTaken) {
            return;
        }

        throw ValidationException::withMessages(['name' => __('A template with this name already exists.')]);
    }
}
