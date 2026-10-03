<?php

namespace App\Http\Controllers;

use App\Models\Workspace;
use App\Support\Database\Transactions;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;

class WorkspaceDetailsController extends Controller
{
    /**
     * The name and the description of the workspace (owner's decision 7 B). The slug,
     * and so every address of the workspace, never changes.
     */
    public function update(Request $request, Workspace $workspace): RedirectResponse
    {
        Gate::authorize('update', $workspace);

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:100'],
            'description' => ['nullable', 'string', 'max:200'],
        ]);

        DB::transaction(function () use ($workspace, $validated): void {
            $locked = Workspace::query()->whereKey($workspace->id)->lockForUpdate()->firstOrFail();

            $locked->update([
                'name' => $validated['name'],
                'description' => $validated['description'] ?? null,
            ]);
        }, Transactions::Attempts);

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Workspace saved.')]);

        return back();
    }
}
