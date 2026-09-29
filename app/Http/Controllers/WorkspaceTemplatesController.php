<?php

namespace App\Http\Controllers;

use App\Actions\Retros\BuildTemplateCatalogue;
use App\Enums\TemplateCategory;
use App\Http\Requests\WorkspaceTemplateRequest;
use App\Models\Workspace;
use App\Models\WorkspaceTemplate;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class WorkspaceTemplatesController extends Controller
{
    public const MaxTemplates = 100;

    public function index(Request $request, Workspace $workspace, BuildTemplateCatalogue $buildTemplateCatalogue): Response
    {
        return Inertia::render('workspaces/templates', [
            'workspace' => $workspace->only(['id', 'name', 'slug']),
            'templates' => $workspace->templates()->with('columns')->orderBy('name')->get()
                ->map(fn (WorkspaceTemplate $template) => $this->present($template))
                ->values(),
            'categories' => TemplateCategory::options(),
            'canManage' => $request->user()->canManage($workspace),
            'catalogue' => Inertia::optional(fn () => $buildTemplateCatalogue->handle($workspace)),
        ]);
    }

    public function store(WorkspaceTemplateRequest $request, Workspace $workspace): RedirectResponse
    {
        DB::transaction(function () use ($request, $workspace): void {
            Workspace::query()->whereKey($workspace->id)->lockForUpdate()->first();

            if ($workspace->templates()->count() >= self::MaxTemplates) {
                throw ValidationException::withMessages(['name' => __('This workspace already has 100 templates.')]);
            }

            $template = $workspace->templates()->create([
                ...$request->templateAttributes(),
                'created_by_user_id' => $request->user()?->id,
            ]);

            $this->replaceColumns($template, $request->templateColumns());
        });

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Template saved.')]);

        return back();
    }

    public function update(WorkspaceTemplateRequest $request, Workspace $workspace, WorkspaceTemplate $template): RedirectResponse
    {
        DB::transaction(function () use ($request, $template): void {
            $template->update($request->templateAttributes());

            $this->replaceColumns($template, $request->templateColumns());
        });

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Template saved.')]);

        return back();
    }

    public function destroy(Workspace $workspace, WorkspaceTemplate $template): RedirectResponse
    {
        Gate::authorize('manageTemplates', $workspace);

        $template->delete();

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Template deleted.')]);

        return back();
    }

    /**
     * @param  array<int, array{title: string, description: ?string, color: string}>  $columns
     */
    private function replaceColumns(WorkspaceTemplate $template, array $columns): void
    {
        $template->columns()->delete();

        foreach ($columns as $position => $column) {
            $template->columns()->create([...$column, 'position' => $position]);
        }
    }

    /**
     * @return array{
     *     id: string,
     *     name: string,
     *     category: string,
     *     columns: array<int, array{title: string, description: ?string, color: string}>
     * }
     */
    private function present(WorkspaceTemplate $template): array
    {
        return [
            'id' => $template->id,
            'name' => $template->name,
            'category' => $template->category->value,
            'columns' => $template->presentColumns(),
        ];
    }
}
