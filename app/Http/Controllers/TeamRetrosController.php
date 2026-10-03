<?php

namespace App\Http\Controllers;

use App\Actions\Games\IcebreakerGameOptions;
use App\Actions\Retros\CreateRetro;
use App\Actions\Retros\NewRetro;
use App\Enums\ColumnColor;
use App\Enums\GameKind;
use App\Http\Requests\WorkspaceTemplateRequest;
use App\Models\Team;
use App\Models\Workspace;
use App\Models\WorkspaceTemplate;
use App\Support\Retros\PhaseDurations;
use App\Support\RetroTemplates\TemplateCatalogue;
use Closure;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;

class TeamRetrosController extends Controller
{
    public function store(Request $request, Workspace $workspace, Team $team, CreateRetro $createRetro, IcebreakerGameOptions $icebreakerGameOptions): RedirectResponse
    {
        Gate::authorize('createRetro', $team);

        $validated = $request->validate([
            'title' => ['required', 'string', 'max:120'],
            'template' => ['required', 'string', $this->availableTemplate($workspace)],
            'is_anonymous' => ['sometimes', 'boolean'],
            'health_check_enabled' => ['sometimes', 'boolean'],
            'icebreaker_enabled' => ['sometimes', 'boolean'],
            'icebreaker_game' => ['sometimes', Rule::enum(GameKind::class), $icebreakerGameOptions->rule()],
            'votes_per_participant' => ['nullable', 'integer', 'min:1', 'max:20'],
            'max_votes_per_card' => ['nullable', 'integer', 'min:1', 'max:20'],
            'ai_summary_enabled' => ['sometimes', 'boolean'],
            'guest_access_enabled' => ['sometimes', 'boolean'],
            'columns' => ['sometimes', 'array', 'min:1', 'max:'.WorkspaceTemplateRequest::MaxColumns],
            'columns.*.title' => ['required', 'string', 'max:100'],
            'columns.*.description' => ['nullable', 'string', 'max:200'],
            'columns.*.color' => ['required', Rule::enum(ColumnColor::class)],
            ...PhaseDurations::rules(),
        ]);

        $retro = $createRetro->handle($team, $request->user(), new NewRetro(
            title: $validated['title'],
            template: $validated['template'],
            isAnonymous: (bool) ($validated['is_anonymous'] ?? false),
            healthCheckEnabled: (bool) ($validated['health_check_enabled'] ?? false),
            icebreakerEnabled: (bool) ($validated['icebreaker_enabled'] ?? false),
            votesPerParticipant: isset($validated['votes_per_participant']) ? (int) $validated['votes_per_participant'] : null,
            aiSummaryEnabled: $request->boolean('ai_summary_enabled', true),
            icebreakerGame: isset($validated['icebreaker_game']) ? GameKind::from($validated['icebreaker_game']) : null,
            guestAccessEnabled: (bool) ($validated['guest_access_enabled'] ?? false),
            columns: $this->columns($validated['columns'] ?? null),
            maxVotesPerCard: isset($validated['max_votes_per_card']) ? (int) $validated['max_votes_per_card'] : null,
            phaseDurations: PhaseDurations::fromValidated($validated['phase_durations'] ?? null),
        ));

        return to_route('retros.show', $retro);
    }

    /**
     * @param  ?array<int, array{title: string, description?: ?string, color: string}>  $columns
     * @return ?array<int, array{title: string, description: ?string, color: ColumnColor}>
     */
    private function columns(?array $columns): ?array
    {
        if ($columns === null) {
            return null;
        }

        return array_map(fn (array $column): array => [
            'title' => $column['title'],
            'description' => $column['description'] ?? null,
            'color' => ColumnColor::from($column['color']),
        ], array_values($columns));
    }

    private function availableTemplate(Workspace $workspace): Closure
    {
        return function (string $attribute, mixed $value, Closure $fail) use ($workspace): void {
            if ($this->isAvailable($workspace, $value)) {
                return;
            }

            $fail(__('Choose a template from the list.'));
        };
    }

    private function isAvailable(Workspace $workspace, mixed $template): bool
    {
        if (! is_string($template)) {
            return false;
        }

        $workspaceTemplateId = WorkspaceTemplate::idFromKey($template);

        if ($workspaceTemplateId !== null) {
            return $workspace->templates()->whereKey($workspaceTemplateId)->exists();
        }

        return TemplateCatalogue::has($template);
    }
}
