<?php

namespace App\Http\Controllers;

use App\Actions\Retros\BuildTemplateCatalogue;
use App\Enums\TemplateCategory;
use App\Enums\TemplateVisibility;
use App\Http\Requests\WorkspaceTemplateRequest;
use App\Models\SavedPokerDeck;
use App\Models\Team;
use App\Models\User;
use App\Models\WhiteboardTemplate;
use App\Models\Workspace;
use App\Models\WorkspaceTemplate;
use App\Support\Alphabetical;
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
    public const int MaxTemplates = 100;

    public function index(Request $request, Workspace $workspace, BuildTemplateCatalogue $buildTemplateCatalogue): Response
    {
        $user = $request->user();
        $visibleTeams = $workspace->teamsVisibleTo($user);
        $visibleTeamIds = $visibleTeams->modelKeys();
        $teamTemplateTeams = $visibleTeams->filter(fn (Team $team): bool => $user->managesRitualsOf($team))->values();

        return Inertia::render('workspaces/templates', [
            'workspace' => $workspace->only(['id', 'name', 'slug']),
            'templates' => $this->retroTemplates($user, $workspace, $visibleTeamIds, $teamTemplateTeams->modelKeys()),
            'categories' => TemplateCategory::options(),
            'whiteboardTemplates' => $this->whiteboardTemplates($request->user(), $workspace),
            'pokerDecks' => $this->pokerDecks($request->user(), $workspace, $visibleTeamIds),
            'canCreatePokerDeck' => $request->user()->can('createForWorkspace', [SavedPokerDeck::class, $workspace]),
            'canCreate' => true,
            'canShareWorkspace' => $user->canManage($workspace),
            'teamTemplateTeams' => $teamTemplateTeams->map(fn (Team $team): array => $team->only(['id', 'name']))->all(),
            'catalogue' => Inertia::optional(fn (): array => $buildTemplateCatalogue->handle($workspace, $user)),
        ]);
    }

    public function store(WorkspaceTemplateRequest $request, Workspace $workspace): RedirectResponse
    {
        DB::transaction(function () use ($request, $workspace): void {
            Workspace::query()->whereKey($workspace->id)->lockForUpdate()->first();

            if ($workspace->templates()->count() >= self::MaxTemplates) {
                throw ValidationException::withMessages(['name' => __('This workspace already has 100 templates.')]);
            }

            if ($request->nameIsTaken()) {
                throw ValidationException::withMessages(['name' => __('A template with this name already exists.')]);
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
        DB::transaction(function () use ($request, $workspace, $template): void {
            Workspace::query()->whereKey($workspace->id)->lockForUpdate()->first();

            if ($request->nameIsTaken()) {
                throw ValidationException::withMessages(['name' => __('A template with this name already exists.')]);
            }

            $lockedTemplate = WorkspaceTemplate::query()->whereKey($template->id)->lockForUpdate()->firstOrFail();

            $lockedTemplate->update([
                ...$request->templateAttributes(),
                ...$this->personalAuthor($request, $lockedTemplate),
            ]);

            $this->replaceColumns($lockedTemplate, $request->templateColumns());

            if ($lockedTemplate->visibility === TemplateVisibility::Personal) {
                $workspace->teams()->where('default_retro_template', $lockedTemplate->catalogueKey())->update(['default_retro_template' => null]);
            }
        }, Transactions::Attempts);

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Template saved.')]);

        return back();
    }

    public function destroy(Workspace $workspace, WorkspaceTemplate $template): RedirectResponse
    {
        Gate::authorize('delete', $template);

        $template->delete();

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Template deleted.')]);

        return back();
    }

    /**
     * A template an editor makes personal becomes theirs: a personal template is only ever its author's.
     *
     * @return array{created_by_user_id?: string}
     */
    private function personalAuthor(WorkspaceTemplateRequest $request, WorkspaceTemplate $template): array
    {
        if ($template->visibility === TemplateVisibility::Personal) {
            return [];
        }

        if ($request->visibility() !== TemplateVisibility::Personal) {
            return [];
        }

        return ['created_by_user_id' => $request->user()?->id];
    }

    /**
     * The usage of a template counts the retros of the teams the user can view, as the usage of a deck does.
     *
     * @param  array<int, string>  $visibleTeamIds
     * @param  array<int, string>  $teamTemplateTeamIds
     * @return Collection<int, array{
     *     id: string,
     *     name: string,
     *     category: string,
     *     visibility: string,
     *     team: array{id: string, name: string}|null,
     *     author: array{name: string, avatarUrl: string}|null,
     *     usageCount: int,
     *     canManage: bool,
     *     columns: array<int, array{title: string, description: ?string, color: string}>
     * }>
     */
    private function retroTemplates(User $user, Workspace $workspace, array $visibleTeamIds, array $teamTemplateTeamIds): Collection
    {
        $managesWorkspace = $user->canManage($workspace);

        $templates = $workspace->templates()
            ->visibleTo($user, $workspace)
            ->with(['columns', 'creator', 'team'])
            ->withCount(['retros' => fn (Builder $retros) => $retros->whereIn('team_id', $visibleTeamIds)])
            ->get();

        return Alphabetical::sort($templates, fn (WorkspaceTemplate $template): string => $template->name)
            ->map(fn (WorkspaceTemplate $template): array => $this->present($template, $this->canManageTemplate($user, $template, $managesWorkspace, $teamTemplateTeamIds)));
    }

    /**
     * The rule of WorkspaceTemplatePolicy::update, read from facts gathered once for the page so the list
     * costs the same number of queries whatever its length.
     *
     * @param  array<int, string>  $teamTemplateTeamIds
     */
    private function canManageTemplate(User $user, WorkspaceTemplate $template, bool $managesWorkspace, array $teamTemplateTeamIds): bool
    {
        return match ($template->visibility) {
            TemplateVisibility::Workspace => $managesWorkspace,
            TemplateVisibility::Team => in_array($template->team_id, $teamTemplateTeamIds, true),
            TemplateVisibility::Personal => $template->created_by_user_id === null ? $managesWorkspace : $template->created_by_user_id === $user->id,
        };
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

        $templates = $workspace->whiteboardTemplates()->get(['id', 'name', 'description', 'preview', 'created_by_user_id']);

        return Alphabetical::sort($templates, fn (WhiteboardTemplate $template): string => $template->name)
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

        $decks = $workspace->pokerDecks()
            ->with('creator')
            ->withCount(['games as usage_count' => fn (Builder $games) => $games->whereIn('team_id', $visibleTeamIds)])
            ->get();

        return Alphabetical::sort($decks, fn (SavedPokerDeck $deck): string => $deck->name)
            ->map(fn (SavedPokerDeck $deck): array => [
                'id' => $deck->id,
                'name' => $deck->name,
                'cards' => $deck->cards,
                'usageCount' => (int) $deck->usage_count,
                'author' => $deck->creator?->presentAsPerson(),
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
     *     visibility: string,
     *     team: array{id: string, name: string}|null,
     *     author: array{name: string, avatarUrl: string}|null,
     *     usageCount: int,
     *     canManage: bool,
     *     columns: array<int, array{title: string, description: ?string, color: string}>
     * }
     */
    private function present(WorkspaceTemplate $template, bool $canManage): array
    {
        return [
            'id' => $template->id,
            'name' => $template->name,
            'category' => $template->category->value,
            'visibility' => $template->visibility->value,
            'team' => $template->team === null ? null : ['id' => $template->team->id, 'name' => $template->team->name],
            'author' => $template->creator?->presentAsPerson(),
            'usageCount' => (int) $template->retros_count,
            'canManage' => $canManage,
            'columns' => $template->presentColumns(),
        ];
    }
}
