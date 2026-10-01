<?php

namespace App\Actions\HealthCheck;

use App\Models\HealthCheckAnswer;
use App\Models\Retro;
use App\Models\RetroHealthStatement;
use Illuminate\Support\Collection;

class PresentHealthProgress
{
    /**
     * @return array<int, array{
     *     key: string,
     *     count: int,
     *     answeredBy: array<int, string>
     * }>
     */
    public function handle(Retro $retro): array
    {
        $answersByStatement = $retro->healthCheckAnswers()->oldest()
            ->get(['participant_id', 'statement'])
            ->groupBy('statement');

        return $retro->healthStatements()->get(['key'])->map(function (RetroHealthStatement $statement) use ($retro, $answersByStatement): array {
            /** @var Collection<int, HealthCheckAnswer> $answers */
            $answers = $answersByStatement->get($statement->key, collect());

            return [
                'key' => $statement->key,
                'count' => $answers->count(),
                'answeredBy' => $retro->is_anonymous ? [] : $answers->pluck('participant_id')->values()->all(),
            ];
        })->values()->all();
    }
}
