<?php

namespace App\Http\Controllers;

use App\Actions\Whiteboards\CopyWhiteboardScene;
use App\Actions\Whiteboards\CreateWhiteboard;
use App\Models\Team;
use App\Models\Workspace;
use App\Support\WhiteboardTemplates\BuiltInTemplates;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/**
 * @phpstan-import-type Scene from CopyWhiteboardScene
 */
class TeamWhiteboardsController extends Controller
{
    public function __construct(private BuiltInTemplates $builtInTemplates) {}

    public function store(Request $request, Workspace $workspace, Team $team, CreateWhiteboard $createWhiteboard): RedirectResponse
    {
        Gate::authorize('createWhiteboard', $team);

        $validated = $request->validate([
            'title' => ['required', 'string', 'max:120'],
            'template' => ['sometimes', 'nullable', 'string', Rule::in(BuiltInTemplates::keys())],
            'workspace_template_id' => ['sometimes', 'nullable', 'uuid'],
        ]);

        $board = $createWhiteboard->handle(
            $team,
            $request->user(),
            $validated['title'],
            $this->scene($workspace, $validated['template'] ?? null, $validated['workspace_template_id'] ?? null),
        );

        return to_route('whiteboards.show', $board);
    }

    /**
     * @return Scene
     */
    private function scene(Workspace $workspace, ?string $builtInKey, ?string $workspaceTemplateId): array
    {
        if ($workspaceTemplateId === null) {
            return ['elements' => $this->builtInTemplates->elements($builtInKey ?? BuiltInTemplates::Blank), 'files' => []];
        }

        if ($builtInKey !== null) {
            throw ValidationException::withMessages(['workspace_template_id' => __('Choose either a built-in template or a workspace template.')]);
        }

        $template = $workspace->whiteboardTemplates()->whereKey($workspaceTemplateId)->first();

        if ($template === null) {
            throw ValidationException::withMessages(['workspace_template_id' => __('Choose a template of this workspace.')]);
        }

        return $template->scene;
    }
}
