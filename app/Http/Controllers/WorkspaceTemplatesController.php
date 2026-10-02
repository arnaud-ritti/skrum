<?php

namespace App\Http\Controllers;

use App\Actions\Retros\BuildTemplateCatalogue;
use App\Enums\TemplateCategory;
use App\Http\Requests\WorkspaceTemplateRequest;
use App\Models\PokerGame;
use App\Models\SavedPokerDeck;
use App\Models\User;
use App\Models\WhiteboardTemplate;
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
            'templates' => $workspace->templates()->with(['columns', 'creator'])->withCount('retros')->orderBy('name')->get()
                ->map(fn (WorkspaceTemplate $template): array => $this->present($template))
                ->values(),
            'categories' => TemplateCategory::options(),
            'whiteboardTemplates' => $this->whiteboardTemplates($request->user(), $workspace),
            'pokerDecks' => $this->pokerDecks($request->user(), $workspace),
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
     * @return array<int, array{
     *     id: string,
     *     name: string,
     *     cards: array<int, string>,
     *     usageCount: int,
     *     author: array{name: string, avatarUrl: string}|null,
     *     canManage: bool
     * }>
     */
    private function pokerDecks(User $user, Workspace $workspace): array
    {
        $canManage = $user->canManage($workspace);
        $decks = $workspace->pokerDecks()->with('creator')->orderBy('name')->get();

        $usageCounts = PokerGame::query()
            ->whereIn('saved_deck_id', $decks->modelKeys())
            ->whereIn('team_id', $workspace->teamsVisibleTo($user)->modelKeys())
            ->selectRaw('saved_deck_id, count(*) as aggregate')
            ->groupBy('saved_deck_id')
            ->pluck('aggregate', 'saved_deck_id');

        return $decks
            ->map(fn (SavedPokerDeck $deck): array => [
                'id' => $deck->id,
                'name' => $deck->name,
                'cards' => $deck->cards,
                'usageCount' => (int) ($usageCounts[$deck->id] ?? 0),
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
