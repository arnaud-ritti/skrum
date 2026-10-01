<?php

namespace App\Actions\HealthCheck;

use App\Models\Participant;
use App\Models\Retro;
use App\Models\RetroHealthStatement;

class PresentHealthCheck
{
    public function __construct(
        private PresentHealthStatement $presentHealthStatement,
        private PresentHealthProgress $presentHealthProgress,
    ) {}

    /**
     * @return array{
     *     statements: array<int, array{
     *         key: string,
     *         label: string,
     *         text: string,
     *         isBuiltin: bool,
     *         count: int,
     *         answeredBy: array<int, string>,
     *         myScore: ?int
     *     }>
     * }|null
     */
    public function handle(Retro $retro, Participant $viewer): ?array
    {
        if (! $retro->health_check_enabled && ! $retro->healthCheckAnswers()->exists()) {
            return null;
        }

        $progress = collect($this->presentHealthProgress->handle($retro))->keyBy('key');
        $myScores = $retro->healthCheckAnswers()->where('participant_id', $viewer->id)->pluck('score', 'statement');

        return [
            'statements' => $retro->healthStatements()->get()->map(function (RetroHealthStatement $statement) use ($progress, $myScores): array {
                $presented = $this->presentHealthStatement->handle($statement);

                return [
                    ...$presented,
                    'count' => $progress[$statement->key]['count'] ?? 0,
                    'answeredBy' => $progress[$statement->key]['answeredBy'] ?? [],
                    'myScore' => isset($myScores[$statement->key]) ? (int) $myScores[$statement->key] : null,
                ];
            })->values()->all(),
        ];
    }
}
