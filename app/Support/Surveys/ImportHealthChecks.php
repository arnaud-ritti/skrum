<?php

namespace App\Support\Surveys;

use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use stdClass;

/**
 * Copies the health checks of before plan 19 into team surveys. Written on
 * the standard query builder alone: it runs from a migration and must not
 * depend on models that change or disappear. It only adds rows, copies
 * scores as they were given, and can run again.
 */
class ImportHealthChecks
{
    private const string Template = 'health_check';

    /**
     * The label stored for a built-in statement is a fallback; readers
     * translate from the `builtin` column.
     */
    private const array BuiltinTexts = [
        'interaction' => 'Interaction with colleagues was productive',
        'task_clarity' => 'Tasks assigned to me were clear',
        'manager_support' => 'My manager was understanding and supportive',
        'vision' => 'The vision and goals are clear to me',
        'processes' => 'Our processes let me work without blockers',
        'motivation' => 'I felt motivated in my work',
    ];

    /**
     * @return array{surveys: int, questions: int, respondents: int, answers: int, skippedAnswers: int}
     */
    public function handle(): array
    {
        $report = ['surveys' => 0, 'questions' => 0, 'respondents' => 0, 'answers' => 0, 'skippedAnswers' => 0];

        if (! Schema::hasTable('retro_health_statements') || ! Schema::hasTable('health_check_answers')) {
            return $report;
        }

        DB::table('retros')
            ->whereIn('id', DB::table('retro_health_statements')->select('retro_id'))
            ->chunkById(100, function (Collection $retros) use (&$report): void {
                foreach ($retros as $retro) {
                    DB::transaction(function () use ($retro, &$report): void {
                        $this->importRetro($retro, $report);
                    });
                }
            });

        return $report;
    }

    /**
     * @param  array{surveys: int, questions: int, respondents: int, answers: int, skippedAnswers: int}  $report
     */
    private function importRetro(stdClass $retro, array &$report): void
    {
        $statements = DB::table('retro_health_statements')->where('retro_id', $retro->id)->orderBy('position')->orderBy('id')->get();
        $answers = DB::table('health_check_answers')->where('retro_id', $retro->id)->orderBy('created_at')->orderBy('id')->get();
        $isCompleted = $retro->phase === 'completed';
        $isEnabled = (bool) $retro->health_check_enabled;

        if ($answers->isEmpty() && ($isCompleted || ! $isEnabled)) {
            return;
        }

        $scaleMax = $answers->isEmpty() ? HealthScale::Max : HealthScale::LegacyMax;
        $surveyId = $this->surveyId($retro, $answers, $this->status($isEnabled, $isCompleted), $report);
        $questionIds = $this->questionIds($surveyId, $statements, $scaleMax, $report);
        $respondentIds = $this->respondentIds($surveyId, $retro, $answers, $report);

        $this->copyAnswers($answers, $questionIds, $respondentIds, $report);
        $this->stampRespondents($answers, $questionIds, $respondentIds);
        $this->nameFacilitator($surveyId, $retro, $respondentIds);
    }

    private function status(bool $isEnabled, bool $isCompleted): string
    {
        if (! $isEnabled) {
            return 'draft';
        }

        return $isCompleted ? 'closed' : 'open';
    }

    /**
     * @param  Collection<int, stdClass>  $answers
     * @param  array{surveys: int, questions: int, respondents: int, answers: int, skippedAnswers: int}  $report
     */
    private function surveyId(stdClass $retro, Collection $answers, string $status, array &$report): string
    {
        $existing = DB::table('team_surveys')->where('retro_id', $retro->id)->where('template', self::Template)->orderBy('created_at')->orderBy('id')->value('id');

        if ($existing !== null) {
            return (string) $existing;
        }

        $id = (string) Str::uuid7();

        DB::table('team_surveys')->insert([
            'id' => $id,
            'team_id' => $retro->team_id,
            'retro_id' => $retro->id,
            'title' => mb_substr((string) $retro->title, 0, 120),
            'template' => self::Template,
            'status' => $status,
            'guest_access_enabled' => false,
            'guest_token' => Str::random(40),
            'one_question_at_a_time' => false,
            'show_results_after_answer' => false,
            'results_threshold' => 0,
            'version' => 1,
            'opened_at' => $answers->min('created_at') ?? $retro->created_at,
            'closed_at' => $status === 'closed' ? ($retro->completed_at ?? $retro->updated_at) : null,
            'created_at' => $retro->created_at,
            'updated_at' => now(),
        ]);

        $report['surveys']++;

        return $id;
    }

    /**
     * A question takes the scale its answers were given on. One created on
     * five by an earlier run, when its retro had no answer yet, moves to ten
     * when old answers arrive, as long as nobody answered it on five.
     *
     * @param  Collection<int, stdClass>  $statements
     * @param  array{surveys: int, questions: int, respondents: int, answers: int, skippedAnswers: int}  $report
     * @return array<string, string> question id by statement key
     */
    private function questionIds(string $surveyId, Collection $statements, int $scaleMax, array &$report): array
    {
        $ids = DB::table('team_survey_questions')->where('team_survey_id', $surveyId)->pluck('id', 'match_key')->all();

        if ($scaleMax === HealthScale::LegacyMax && $ids !== []) {
            DB::table('team_survey_questions')
                ->whereIn('id', array_values($ids))
                ->where('scale_max', '!=', HealthScale::LegacyMax)
                ->whereNotIn('id', DB::table('team_survey_answers')->select('team_survey_question_id'))
                ->update(['scale_max' => HealthScale::LegacyMax]);
        }

        foreach ($statements as $statement) {
            if (isset($ids[$statement->key])) {
                continue;
            }

            $id = (string) Str::uuid7();

            DB::table('team_survey_questions')->insert([
                'id' => $id,
                'team_survey_id' => $surveyId,
                'kind' => 'scale',
                'label' => mb_substr((string) ($statement->text ?? self::BuiltinTexts[$statement->builtin] ?? $statement->key), 0, 200),
                'short_label' => $statement->label,
                'builtin' => $statement->builtin,
                'match_key' => $statement->key,
                'position' => (int) $statement->position,
                'is_required' => true,
                'allows_comment' => false,
                'scale_max' => $scaleMax,
                'created_at' => $statement->created_at,
                'updated_at' => now(),
            ]);

            $ids[$statement->key] = $id;
            $report['questions']++;
        }

        return $ids;
    }

    /**
     * One respondent per participant who answered, and one for the
     * facilitator. A respondent the application already created for the
     * same user is reused.
     *
     * @param  Collection<int, stdClass>  $answers
     * @param  array{surveys: int, questions: int, respondents: int, answers: int, skippedAnswers: int}  $report
     * @return array<string, string> respondent id by participant id
     */
    private function respondentIds(string $surveyId, stdClass $retro, Collection $answers, array &$report): array
    {
        $participantIds = $answers->pluck('participant_id')
            ->push($retro->facilitator_participant_id)
            ->filter()
            ->unique()
            ->values();

        $participants = DB::table('participants')->whereIn('id', $participantIds)->get()->keyBy('id');
        $existing = DB::table('team_survey_respondents')->where('team_survey_id', $surveyId)->get();
        $ids = $existing->whereNotNull('participant_id')->pluck('id', 'participant_id')->all();
        $byUser = $existing->whereNotNull('user_id')->pluck('id', 'user_id')->all();

        foreach ($participantIds as $participantId) {
            $participant = $participants->get($participantId);

            if ($participant === null || isset($ids[$participantId])) {
                continue;
            }

            if ($participant->user_id !== null && isset($byUser[$participant->user_id])) {
                DB::table('team_survey_respondents')->where('id', $byUser[$participant->user_id])->update(['participant_id' => $participantId]);
                $ids[$participantId] = (string) $byUser[$participant->user_id];

                continue;
            }

            $id = (string) Str::uuid7();

            DB::table('team_survey_respondents')->insert([
                'id' => $id,
                'team_survey_id' => $surveyId,
                'user_id' => $participant->user_id,
                'participant_id' => $participantId,
                'guest_name' => $participant->guest_name,
                'guest_secret_hash' => null,
                'created_at' => $participant->created_at,
                'updated_at' => now(),
            ]);

            $ids[$participantId] = $id;
            $report['respondents']++;
        }

        return $ids;
    }

    /**
     * An answer already copied is left as it is; an answer to a statement
     * outside the frozen set is counted and left behind, as every reader
     * ignored it, and so is an answer to a question someone already answered
     * on five in the application. The score is copied as it was given.
     *
     * @param  Collection<int, stdClass>  $answers
     * @param  array<string, string>  $questionIds
     * @param  array<string, string>  $respondentIds
     * @param  array{surveys: int, questions: int, respondents: int, answers: int, skippedAnswers: int}  $report
     */
    private function copyAnswers(Collection $answers, array $questionIds, array $respondentIds, array &$report): void
    {
        $copied = DB::table('team_survey_answers')
            ->whereIn('team_survey_question_id', array_values($questionIds))
            ->get(['team_survey_question_id', 'team_survey_respondent_id'])
            ->mapWithKeys(fn (stdClass $row): array => ["{$row->team_survey_question_id}|{$row->team_survey_respondent_id}" => true])
            ->all();

        $scaleMaxes = DB::table('team_survey_questions')->whereIn('id', array_values($questionIds))->pluck('scale_max', 'id');

        $rows = [];

        foreach ($answers as $answer) {
            $questionId = $questionIds[$answer->statement] ?? null;
            $respondentId = $respondentIds[$answer->participant_id] ?? null;

            if ($questionId === null || $respondentId === null) {
                $report['skippedAnswers']++;

                continue;
            }

            if ((int) $scaleMaxes->get($questionId) !== HealthScale::LegacyMax) {
                $report['skippedAnswers']++;

                continue;
            }

            if (isset($copied["{$questionId}|{$respondentId}"])) {
                continue;
            }

            $copied["{$questionId}|{$respondentId}"] = true;

            $rows[] = [
                'id' => (string) Str::uuid(),
                'team_survey_question_id' => $questionId,
                'team_survey_respondent_id' => $respondentId,
                'value' => (int) $answer->score,
                'created_at' => $answer->created_at,
                'updated_at' => $answer->updated_at,
            ];
        }

        foreach (array_chunk($rows, 500) as $chunk) {
            DB::table('team_survey_answers')->insert($chunk);
        }

        $report['answers'] += count($rows);
    }

    /**
     * A participant who answered every statement has sent their answers:
     * the time of their last answer stands for it. Someone who answered part
     * of an open health check can still send the rest.
     *
     * @param  Collection<int, stdClass>  $answers
     * @param  array<string, string>  $questionIds
     * @param  array<string, string>  $respondentIds
     */
    private function stampRespondents(Collection $answers, array $questionIds, array $respondentIds): void
    {
        $answers
            ->filter(fn (stdClass $answer): bool => isset($questionIds[$answer->statement], $respondentIds[$answer->participant_id]))
            ->groupBy('participant_id')
            ->filter(fn (Collection $own): bool => $own->pluck('statement')->unique()->count() === count($questionIds))
            ->each(function (Collection $own, string $participantId) use ($respondentIds): void {
                DB::table('team_survey_respondents')
                    ->where('id', $respondentIds[$participantId])
                    ->whereNull('completed_at')
                    ->update(['completed_at' => $own->max('updated_at')]);
            });
    }

    /**
     * @param  array<string, string>  $respondentIds
     */
    private function nameFacilitator(string $surveyId, stdClass $retro, array $respondentIds): void
    {
        $respondentId = $respondentIds[$retro->facilitator_participant_id] ?? null;

        if ($respondentId === null) {
            return;
        }

        DB::table('team_surveys')
            ->where('id', $surveyId)
            ->whereNull('facilitator_respondent_id')
            ->update([
                'facilitator_respondent_id' => $respondentId,
                'created_by_user_id' => DB::table('team_survey_respondents')->where('id', $respondentId)->value('user_id'),
            ]);
    }
}
