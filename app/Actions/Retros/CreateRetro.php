<?php

namespace App\Actions\Retros;

use App\Actions\HealthCheck\FreezeHealthStatements;
use App\Enums\ColumnColor;
use App\Enums\GameKind;
use App\Models\Retro;
use App\Models\Team;
use App\Models\User;
use App\Models\WorkspaceTemplate;
use App\Models\WorkspaceTemplateColumn;
use App\Support\Llm\Llm;
use App\Support\RetroTemplates\TemplateCatalogue;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use InvalidArgumentException;

class CreateRetro
{
    public function __construct(
        private FreezeHealthStatements $freezeHealthStatements,
        private Llm $llm,
    ) {}

    public function handle(Team $team, User $creator, NewRetro $data): Retro
    {
        return DB::transaction(function () use ($team, $creator, $data): Retro {
            $workspaceTemplate = $this->workspaceTemplate($team, $data->template);

            $retro = $team->retros()->make([
                'title' => $data->title,
                'template' => $workspaceTemplate === null ? $data->template : TemplateCatalogue::Workspace,
                'workspace_template_id' => $workspaceTemplate?->id,
                'is_anonymous' => $data->isAnonymous,
                'health_check_enabled' => $data->healthCheckEnabled,
                'icebreaker_enabled' => $data->icebreakerEnabled,
                'icebreaker_game' => $data->icebreakerGame ?? GameKind::DrawAndGuess,
                'votes_per_participant' => $data->votesPerParticipant,
                'ai_summary_enabled' => $data->aiSummaryEnabled && $this->llm->isConfigured(),
                'guest_token' => Str::random(40),
            ]);

            $retro->phase = $retro->firstPhase();
            $retro->save();

            foreach ($this->columns($data->template, $workspaceTemplate) as $position => $column) {
                $retro->columns()->create([...$column, 'position' => $position]);
            }

            if ($data->healthCheckEnabled) {
                $this->freezeHealthStatements->handle($retro);
            }

            $facilitator = $retro->participants()->create(['user_id' => $creator->id]);

            $retro->update(['facilitator_participant_id' => $facilitator->id]);

            return $retro->fresh(['columns', 'facilitator']);
        });
    }

    private function workspaceTemplate(Team $team, string $template): ?WorkspaceTemplate
    {
        $id = WorkspaceTemplate::idFromKey($template);

        if ($id === null) {
            return null;
        }

        return $team->workspace->templates()->with('columns')->findOrFail($id);
    }

    /**
     * @return array<int, array{
     *     title: string,
     *     description: ?string,
     *     color: ColumnColor
     * }>
     */
    private function columns(string $template, ?WorkspaceTemplate $workspaceTemplate): array
    {
        if ($workspaceTemplate !== null) {
            return $workspaceTemplate->columns->map(fn (WorkspaceTemplateColumn $column) => [
                'title' => $column->title,
                'description' => $column->description,
                'color' => $column->color,
            ])->values()->all();
        }

        $definition = TemplateCatalogue::find($template);

        if ($definition === null) {
            throw new InvalidArgumentException("Unknown retro template [{$template}].");
        }

        return $definition->translatedColumns();
    }
}
