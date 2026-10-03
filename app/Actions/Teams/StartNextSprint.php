<?php

namespace App\Actions\Teams;

use App\Models\Team;
use App\Models\TeamSprint;
use App\Support\Database\Transactions;
use Carbon\CarbonImmutable;
use Carbon\CarbonInterface;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class StartNextSprint
{
    public const int MaxNumber = 9999;

    /**
     * Starts a sprint today, ending the current one yesterday (spec §6.3, rule 3).
     */
    public function handle(Team $team, CarbonInterface $now): TeamSprint
    {
        return DB::transaction(function () use ($team, $now): TeamSprint {
            $locked = Team::query()->whereKey($team->id)->lockForUpdate()->firstOrFail();
            $next = $this->preview($locked, $now);

            if ($next['refusal'] !== null) {
                throw ValidationException::withMessages(['sprint' => $next['refusal']]);
            }

            $today = $this->today($now);

            $locked->sprints()
                ->where('starts_on', '<', $today->toDateString())
                ->where('ends_on', '>=', $today->toDateString())
                ->first()
                ?->update(['ends_on' => $today->subDay()->toDateString()]);

            return $locked->sprints()->create([
                'number' => $next['number'],
                'starts_on' => $next['startsOn'],
                'ends_on' => $next['endsOn'],
            ]);
        }, Transactions::Attempts);
    }

    /**
     * What "Start the next sprint" would create now, or why it is refused.
     *
     * @return array{number: int, startsOn: string, endsOn: string, refusal: ?string}
     */
    public function preview(Team $team, CarbonInterface $now): array
    {
        $today = $this->today($now);
        $length = $team->sprint_length_weeks ?? Team::DefaultSprintLengthWeeks;
        $number = ((int) $team->sprints()->max('number')) + 1;

        return [
            'number' => $number,
            'startsOn' => $today->toDateString(),
            'endsOn' => $today->addDays(7 * $length - 1)->toDateString(),
            'refusal' => $this->refusal($team, $today, $number),
        ];
    }

    private function refusal(Team $team, CarbonImmutable $today, int $number): ?string
    {
        $later = $team->sprints()->where('starts_on', '>=', $today->toDateString())->first();

        if ($later !== null && $later->starts_on->toDateString() === $today->toDateString()) {
            return __('Sprint :number already starts today.', ['number' => $later->number]);
        }

        if ($later !== null) {
            return __('Sprint :number is already planned from :date.', ['number' => $later->number, 'date' => $later->starts_on->isoFormat('D MMM')]);
        }

        if ($number > self::MaxNumber) {
            return __('Sprint numbers stop at :max.', ['max' => self::MaxNumber]);
        }

        return null;
    }

    private function today(CarbonInterface $now): CarbonImmutable
    {
        return CarbonImmutable::instance($now)->setTimezone((string) config('app.timezone'))->startOfDay();
    }
}
