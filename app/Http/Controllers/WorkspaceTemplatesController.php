<?php

namespace App\Http\Controllers;

use App\Actions\Retros\BuildTemplateCatalogue;
use App\Enums\TemplateCategory;
use App\Http\Requests\WorkspaceTemplateRequest;
use App\Models\SavedPokerDeck;
use App\Models\User;
use App\Models\WhiteboardTemplate;
use App\Models\Workspace;
use App\Models\WorkspaceTemplate;
use App\Support\Database\Transactions;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
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
        $visibleTeamIds = $workspace->teamsVisibleTo($request->user())->modelKeys();

        return Inertia::render('workspaces/templates', [
            'workspace' => $workspace->only(['id', 'name', 'slug']),
            'templates' => $this->retroTemplates($workspace, $visibleTeamIds),
            'categories' => TemplateCategory::options(),
            'whiteboardTemplates' => $this->whiteboardTemplates($request->user(), $workspace),
            'pokerDecks' => $this->pokerDecks($request->user(), $workspace, $visibleTeamIds),
            'canCreatePokerDeck' => $request->user()->can('createForWorkspace', [SavedPokerDeck::class, $workspace]),
            'canManage' => $request->user()->canManage($workspace),
            'catalogue' => Inertia::optional(fn (): array => $buildTemplateCatalogue->handle($workspace)),
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
        }, Transactions::Attempts);

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Template saved.')]);

        return back();
    }

    public function update(WorkspaceTemplateRequest $request, Workspace $workspace, WorkspaceTemplate $template): RedirectResponse
    {
        DB::transaction(function () use ($request, $template): void {
            $lockedTemplate = WorkspaceTemplate::query()->whereKey($template->id)->lockForUpdate()->firstOrFail();

            $lockedTemplate->update($request->templateAttributes());

            $this->replaceColumns($lockedTemplate, $request->templateColumns());
        }, Transactions::Attempts);

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
     * The usage of a template counts the retros of the teams the user can view, as the usage of a deck does.
     *
     * @param  array<int, string>  $visibleTeamIds
     * @return Collection<int, array{
     *     id: string,
     *     name: string,
     *     category: string,
     *     author: array{name: string, avatarUrl: string}|null,
     *     usageCount: int,
     *     columns: array<int, array{title: string, description: ?string, color: string}>
     * }>
     */
    private function retroTemplates(Workspace $workspace, array $visibleTeamIds): Collection
    {
        return $workspace->templates()
            ->with(['columns', 'creator'])
            ->withCount(['retros' => fn (Builder $retros) => $retros->whereIn('team_id', $visibleTeamIds)])
            ->orderBy('name')
            ->get()
            ->map(fn (WorkspaceTemplate $template): array => $this->present($template))
            ->values();
    }

    /**
     * @return array<int, array{
     *     id: string,
     *     name: string,
     *     description: ?string,
     *     preview: array<string, mixed>,
     *     canManage: bool
     * }>
     */
    private function whiteboardTemplates(User $user, Workspace $workspace): array
    {
        $managesWorkspace = $user->canManage($workspace);

        return $workspace->whiteboardTemplates()
            ->orderBy('name')
            ->get(['id', 'name', 'description', 'preview', 'created_by_user_id'])
            ->map(fn (WhiteboardTemplate $template): array => [
                'id' => $template->id,
                'name' => $template->name,
                'description' => $template->description,
                'preview' => $template->preview,
                'canManage' => $managesWorkspace || $template->created_by_user_id === $user->id,
            ])
            ->all();
    }

    /**
     * @param  array<int, string>  $visibleTeamIds
     * @return array<int, array{
     *     id: string,
     *     name: string,
     *     cards: array<int, string>,
     *     usageCount: int,
     *     author: array{name: string, avatarUrl: string}|null,
     *     canManage: bool
     * }>
     */
    private function pokerDecks(User $user, Workspace $workspace, array $visibleTeamIds): array
    {
        $canManage = $user->canManage($workspace);

        return $workspace->pokerDecks()
            ->with('creator')
            ->withCount(['games as usage_count' => fn (Builder $games) => $games->whereIn('team_id', $visibleTeamIds)])
            ->orderBy('name')
            ->get()
            ->map(fn (SavedPokerDeck $deck): array => [
                'id' => $deck->id,
                'name' => $deck->name,
                'cards' => $deck->cards,
                'usageCount' => (int) $deck->usage_count,
                'author' => $this->author($deck->creator),
                'canManage' => $canManage,
            ])
            ->all();
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
     *     author: array{name: string, avatarUrl: string}|null,
     *     usageCount: int,
     *     columns: array<int, array{title: string, description: ?string, color: string}>
     * }
     */
    private function present(WorkspaceTemplate $template): array
    {
        return [
            'id' => $template->id,
            'name' => $template->name,
            'category' => $template->category->value,
            'author' => $this->author($template->creator),
            'usageCount' => (int) $template->retros_count,
            'columns' => $template->presentColumns(),
        ];
    }

    /**
     * @return array{
     *     name: string,
     *     avatarUrl: string
     * }|null
     */
    private function author(?User $creator): ?array
    {
        if ($creator === null) {
            return null;
        }

        return [
            'name' => $creator->name,
            'avatarUrl' => $creator->avatarUrl(),
        ];
    }
}
