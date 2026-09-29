<?php

namespace App\Actions\Workspaces;

use App\Enums\WorkspaceRole;
use App\Models\User;
use App\Models\Workspace;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class CreateWorkspace
{
    public function handle(User $owner, string $name): Workspace
    {
        return DB::transaction(function () use ($owner, $name): Workspace {
            $workspace = Workspace::create([
                'name' => $name,
                'slug' => $this->uniqueSlug($name),
            ]);

            $workspace->members()->attach($owner, ['role' => WorkspaceRole::Owner->value]);

            $owner->forceFill(['current_workspace_id' => $workspace->id])->save();

            return $workspace;
        });
    }

    private function uniqueSlug(string $name): string
    {
        $base = Str::slug($name) ?: 'workspace';

        do {
            $slug = "{$base}-".Str::lower(Str::random(6));
        } while (Workspace::query()->where('slug', $slug)->exists());

        return $slug;
    }
}
