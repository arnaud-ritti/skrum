<?php

namespace App\Actions\HealthCheck;

use App\Actions\TeamSurveys\WriteSurveyQuestions;
use App\Enums\HealthStatement;
use App\Enums\TeamSurveyStatus;
use App\Enums\TeamSurveyTemplate;
use App\Events\Retros\RetroSettingsChanged;
use App\Events\TeamSurveys\TeamSurveyChanged;
use App\Models\Team;
use App\Models\TeamHealthStatement;
use App\Models\TeamSurvey;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class ManageTeamHealthStatements
{
    public const MinimumActive = 3;

    public const MaximumActive = 10;

    public const MaximumTotal = 30;

    public function __construct(
        private TeamHealthStatements $teamHealthStatements,
        private HealthCheckQuestions $healthCheckQuestions,
        private WriteSurveyQuestions $writeSurveyQuestions,
    ) {}

    public function add(Team $team, string $text, string $label): TeamHealthStatement
    {
        return $this->change($team, function (Team $locked) use ($text, $label): TeamHealthStatement {
            $all = $locked->healthStatements()->get();

            if ($all->count() >= self::MaximumTotal) {
                throw ValidationException::withMessages([
                    'text' => __('A team can have at most 30 health check statements, archived ones included.'),
                ]);
            }

            $this->ensureActiveCount($this->teamHealthStatements->active($locked)->count() + 1);

            return $locked->healthStatements()->create([
                'text' => $text,
                'label' => $label,
                'position' => (int) $all->max('position') + 1,
            ]);
        });
    }

    public function reword(Team $team, string $statement, string $text, string $label): TeamHealthStatement
    {
        return $this->change($team, function (Team $locked) use ($statement, $text, $label): TeamHealthStatement {
            $found = $this->find($locked, $statement);

            if ($found->isBuiltin()) {
                throw ValidationException::withMessages(['text' => __('Built-in statements cannot be reworded.')]);
            }

            $found->update(['text' => $text, 'label' => $label]);

            return $found;
        });
    }

    /**
     * @param  array<int, string>  $ids  row ids or built-in values, every active statement once
     */
    public function reorder(Team $team, array $ids): void
    {
        $this->change($team, function (Team $locked) use ($ids): void {
            $active = $this->teamHealthStatements->active($locked);

            $ordered = collect($ids)->map(fn (string $id): ?TeamHealthStatement => $this->match($active, $id));

            $resolvedIds = $ordered->map(fn (?TeamHealthStatement $statement) => $statement?->id)->all();
            $activeIds = $active->pluck('id')->all();

            sort($resolvedIds);
            sort($activeIds);

            if ($ordered->contains(null) || $resolvedIds !== $activeIds) {
                throw ValidationException::withMessages(['ids' => __('Send every active health check statement exactly once.')]);
            }

            $ordered->each(fn (?TeamHealthStatement $statement, int $position) => $statement?->update(['position' => $position]));
        });
    }

    public function archive(Team $team, string $statement): void
    {
        $this->change($team, function (Team $locked) use ($statement): void {
            $found = $this->find($locked, $statement);

            if ($found->isArchived()) {
                return;
            }

            $this->ensureActiveCount($this->teamHealthStatements->active($locked)->count() - 1);

            $found->update(['archived_at' => now()]);
        });
    }

    public function restore(Team $team, string $statement): void
    {
        $this->change($team, function (Team $locked) use ($statement): void {
            $found = $this->find($locked, $statement);

            if (! $found->isArchived()) {
                return;
            }

            $all = $locked->healthStatements()->get();

            $this->ensureActiveCount($this->teamHealthStatements->active($locked)->count() + 1);

            $found->update(['archived_at' => null, 'position' => (int) $all->max('position') + 1]);
        });
    }

    /**
     * @template TResult
     *
     * @param  callable(Team): TResult  $change
     * @return TResult
     */
    private function change(Team $team, callable $change): mixed
    {
        return DB::transaction(function () use ($team, $change): mixed {
            $locked = Team::query()->whereKey($team->id)->lockForUpdate()->firstOrFail();

            $this->materialize($locked);

            $result = $change($locked);

            $this->refreshUnansweredHealthChecks($locked);

            return $result;
        });
    }

    /**
     * Statements follow the team until the first answer: answers refer to
     * the questions they were given to. The team is locked first by
     * `change()`; each survey is locked after it.
     */
    private function refreshUnansweredHealthChecks(Team $team): void
    {
        $surveyIds = TeamSurvey::query()
            ->where('team_id', $team->id)
            ->where('template', TeamSurveyTemplate::HealthCheck)
            ->where('status', '!=', TeamSurveyStatus::Closed)
            ->orderBy('id')
            ->pluck('id');

        foreach ($surveyIds as $surveyId) {
            $survey = TeamSurvey::query()->whereKey($surveyId)->lockForUpdate()->first();

            if ($survey === null || $survey->status === TeamSurveyStatus::Closed || $survey->hasAnswers()) {
                continue;
            }

            $this->writeSurveyQuestions->handle($survey, $this->healthCheckQuestions->handle($team));

            $survey->increment('version');

            TeamSurveyChanged::for($survey)->sendToOthers();

            if ($survey->retro_id !== null) {
                (new RetroSettingsChanged($survey->retro_id))->sendToOthers();
            }
        }
    }

    private function materialize(Team $team): void
    {
        if ($team->healthStatements()->exists()) {
            return;
        }

        foreach ($this->teamHealthStatements->defaults() as $statement) {
            $team->healthStatements()->create([
                'builtin' => $statement->builtin,
                'position' => $statement->position,
            ]);
        }
    }

    private function find(Team $team, string $statement): TeamHealthStatement
    {
        $found = $this->match($team->healthStatements()->get(), $statement);

        abort_if($found === null, 404);

        return $found;
    }

    /**
     * @param  Collection<int, TeamHealthStatement>  $statements
     */
    private function match(Collection $statements, string $statement): ?TeamHealthStatement
    {
        $builtin = HealthStatement::tryFrom($statement);

        if ($builtin !== null) {
            return $statements->first(fn (TeamHealthStatement $candidate): bool => $candidate->builtin === $builtin);
        }

        if (! Str::isUuid($statement)) {
            return null;
        }

        return $statements->firstWhere('id', $statement);
    }

    private function ensureActiveCount(int $count): void
    {
        if ($count >= self::MinimumActive && $count <= self::MaximumActive) {
            return;
        }

        throw ValidationException::withMessages(['statements' => __('A team needs between 3 and 10 health check statements.')]);
    }
}
