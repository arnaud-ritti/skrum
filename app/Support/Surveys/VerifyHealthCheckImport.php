<?php

namespace App\Support\Surveys;

use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use stdClass;

class VerifyHealthCheckImport
{
    /**
     * The retros whose copied answers differ from the old ones, counting
     * only answers to a statement of the retro's frozen set. Raw values on
     * both sides: the health scale of spec §11.9 is applied on read only.
     *
     * @return array<int, array{retroId: string, title: string, oldAnswers: int, newAnswers: int, oldSum: int, newSum: int}>
     */
    public function handle(): array
    {
        if (! Schema::hasTable('retro_health_statements') || ! Schema::hasTable('health_check_answers')) {
            return [];
        }

        $differences = [];

        DB::table('retros')
            ->whereIn('id', DB::table('health_check_answers')->select('retro_id'))
            ->chunkById(100, function (Collection $retros) use (&$differences): void {
                foreach ($retros as $retro) {
                    $difference = $this->compare($retro);

                    if ($difference !== null) {
                        $differences[] = $difference;
                    }
                }
            });

        return $differences;
    }

    /**
     * @return array{retroId: string, title: string, oldAnswers: int, newAnswers: int, oldSum: int, newSum: int}|null
     */
    private function compare(stdClass $retro): ?array
    {
        $keys = DB::table('retro_health_statements')->where('retro_id', $retro->id)->pluck('key');

        $old = DB::table('health_check_answers')->where('retro_id', $retro->id)->whereIn('statement', $keys)->pluck('score');

        $new = DB::table('team_survey_answers')
            ->whereIn('team_survey_question_id', DB::table('team_survey_questions')
                ->whereIn('team_survey_id', DB::table('team_surveys')->where('retro_id', $retro->id)->where('template', 'health_check')->select('id'))
                ->select('id'))
            ->pluck('value');

        $row = [
            'retroId' => (string) $retro->id,
            'title' => (string) $retro->title,
            'oldAnswers' => $old->count(),
            'newAnswers' => $new->count(),
            'oldSum' => (int) $old->sum(fn (mixed $score): int => (int) $score),
            'newSum' => (int) $new->sum(fn (mixed $value): int => (int) $value),
        ];

        if ($row['oldAnswers'] === $row['newAnswers'] && $row['oldSum'] === $row['newSum']) {
            return null;
        }

        return $row;
    }
}
