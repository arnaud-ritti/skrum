<?php

namespace App\Actions\Whiteboards;

use App\Models\WhiteboardTemplate;
use App\Models\Workspace;
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

        throw ValidationException::withMessages(['name' => __('This workspace already has 50 whiteboard templates.')]);
    }

    public static function ensureNameIsFree(Workspace $lockedWorkspace, string $name, ?WhiteboardTemplate $ignore = null): void
    {
        $isTaken = $lockedWorkspace->whiteboardTemplates()
            ->whereRaw('lower(name) = lower(?)', [trim($name)])
            ->when($ignore !== null, fn ($query) => $query->whereKeyNot($ignore?->id))
            ->exists();

        if (! $isTaken) {
            return;
        }

        throw ValidationException::withMessages(['name' => __('A template with this name already exists.')]);
    }
}
