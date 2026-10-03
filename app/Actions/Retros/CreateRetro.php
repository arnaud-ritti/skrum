<?php

namespace App\Actions\Retros;

use App\Actions\HealthCheck\AttachHealthCheck;
use App\Actions\Teams\SuggestedFacilitator;
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
        private AttachHealthCheck $attachHealthCheck,
        private Llm $llm,
        private SuggestedFacilitator $suggestedFacilitator,
    ) {}

    public function handle(Team $team, User $creator, NewRetro $data): Retro
    {
        return DB::transaction(function () use ($team, $creator, $data): Retro {
            $lockedTeam = Team::query()->whereKey($team->id)->lockForUpdate()->firstOrFail();
            $facilitatorUser = $data->facilitatorUserId === null ? $creator : User::query()->findOrFail($data->facilitatorUserId);
            $this->suggestedFacilitator->follow($lockedTeam, $facilitatorUser);
            $workspaceTemplate = $this->workspaceTemplate($team, $creator, $data->template);

            $retro = $team->retros()->make([
                'title' => $data->title,
                'template' => $workspaceTemplate === null ? $data->template : TemplateCatalogue::Workspace,
                'workspace_template_id' => $workspaceTemplate?->id,
                'is_anonymous' => $data->isAnonymous,
                'icebreaker_enabled' => $data->icebreakerEnabled,
                'icebreaker_game' => $data->icebreakerGame ?? GameKind::DrawAndGuess,
                'votes_per_participant' => $data->votesPerParticipant,
                'max_votes_per_card' => $data->maxVotesPerCard,
                'phase_durations' => $data->phaseDurations,
                'ai_summary_enabled' => $data->aiSummaryEnabled && $this->llm->isConfigured(),
                'guest_access_enabled' => $data->guestAccessEnabled,
                'guest_token' => Str::random(40),
            ]);

            $retro->phase = $retro->firstPhase();
            $retro->save();

            foreach ($data->columns ?? $this->columns($data->template, $workspaceTemplate) as $position => $column) {
                $retro->columns()->create([...$column, 'position' => $position]);
            }

            $facilitator = $retro->participants()->create(['user_id' => $facilitatorUser->id]);

            $retro->update(['facilitator_participant_id' => $facilitator->id]);

            if ($data->healthCheckEnabled) {
                $this->attachHealthCheck->handle($retro->setRelation('facilitator', $facilitator));
            }

            return $retro->fresh(['columns', 'facilitator']);
        });
    }

    private function workspaceTemplate(Team $team, User $creator, string $template): ?WorkspaceTemplate
    {
        $id = WorkspaceTemplate::idFromKey($template);

        if ($id === null) {
            return null;
        }

        return $team->workspace->templates()->visibleTo($creator, $team->workspace, $team)->with('columns')->findOrFail($id);
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
            return $workspaceTemplate->columns->map(fn (WorkspaceTemplateColumn $column): array => [
                'title' => $column->title,
                'description' => $column->description,
                'color' => $column->color,
            ])->values()->all();
        }

        $definition = TemplateCatalogue::find($template);

        throw_if($definition === null, InvalidArgumentException::class, "Unknown retro template [{$template}].");

        return $definition->translatedColumns();
    }
}
