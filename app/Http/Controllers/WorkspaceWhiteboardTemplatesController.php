<?php

namespace App\Http\Controllers;

use App\Actions\Whiteboards\WhiteboardTemplateRules;
use App\Models\WhiteboardTemplate;
use App\Models\Workspace;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;

class WorkspaceWhiteboardTemplatesController extends Controller
{
    public function update(Request $request, Workspace $workspace, WhiteboardTemplate $whiteboardTemplate): RedirectResponse
    {
        Gate::authorize('update', $whiteboardTemplate);

        $validated = $request->validate([
            'name' => ['sometimes', 'required', 'string', 'max:80'],
            'description' => ['sometimes', 'nullable', 'string', 'max:300'],
        ]);

        DB::transaction(function () use ($workspace, $whiteboardTemplate, $validated): void {
            $locked = Workspace::query()->whereKey($workspace->id)->lockForUpdate()->firstOrFail();

            if (array_key_exists('name', $validated)) {
                WhiteboardTemplateRules::ensureNameIsFree($locked, $validated['name'], $whiteboardTemplate);
            }

            $whiteboardTemplate->update($validated);
        });

        return back();
    }

    public function destroy(Workspace $workspace, WhiteboardTemplate $whiteboardTemplate): RedirectResponse
    {
        Gate::authorize('delete', $whiteboardTemplate);

        $whiteboardTemplate->delete();

        return back();
    }
}
