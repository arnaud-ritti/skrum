<?php

namespace App\Support\Teams;

use App\Models\Team;
use App\Models\TeamSprint;
use Carbon\CarbonImmutable;
use Carbon\CarbonInterface;

/**
 * The sprints of a team, as stored rows, and the next retro they give with the team's retro day.
 * Days are read in the application's time zone; the sprint of a session is the sprint
 * that contains the day it was created.
 *
 * @phpstan-type Sprint array{id: string, number: int, startsOn: string, endsOn: string}
 * @phpstan-type NextRetro array{date: string, time: ?string}
 */
class SprintCalendar
{
    /**
     * @param  list<Sprint>  $sprints  ordered by their first day
     */
    public function __construct(
        private array $sprints,
        public string $timezone,
        public ?int $retroWeekday = null,
        public ?string $retroTime = null,
    ) {}

    /**
     * The team's sprints that share at least one day with the window.
     */
    public static function forTeam(Team $team, CarbonInterface $from, ?CarbonInterface $to = null): self
    {
        $rows = $team->sprints()
            ->where('ends_on', '>=', self::dayOf($from))
            ->where('starts_on', '<=', self::dayOf($to ?? $from))
            ->get();

        return self::ofRows($rows, $team->retro_weekday, $team->retro_time);
    }

    /**
     * The current sprint and the next one: enough for "Sprint 42 · Next retro …".
     */
    public static function fromToday(Team $team, CarbonInterface $now): self
    {
        $rows = $team->sprints()
            ->where('ends_on', '>=', self::dayOf($now))
            ->limit(2)
            ->get();

        return self::ofRows($rows, $team->retro_weekday, $team->retro_time);
    }

    /**
     * @param  iterable<TeamSprint>  $rows
     */
    public static function ofRows(iterable $rows, ?int $retroWeekday = null, ?string $retroTime = null): self
    {
        $sprints = [];

        foreach ($rows as $row) {
            $sprints[] = $row->present();
        }

        usort($sprints, fn (array $first, array $second): int => [$first['startsOn'], $first['id']] <=> [$second['startsOn'], $second['id']]);

        return new self($sprints, self::timezone(), $retroWeekday, $retroTime);
    }

    public static function dayOf(CarbonInterface $moment): string
    {
        return CarbonImmutable::instance($moment)->setTimezone(self::timezone())->toDateString();
    }

    /**
     * @return Sprint|null
     */
    public function sprintOn(CarbonInterface $moment): ?array
    {
        $day = CarbonImmutable::instance($moment)->setTimezone($this->timezone)->toDateString();

        foreach ($this->sprints as $sprint) {
            if ($sprint['startsOn'] <= $day && $day <= $sprint['endsOn']) {
                return $sprint;
            }
        }

        return null;
    }

    public function numberOn(CarbonInterface $moment): ?int
    {
        return $this->sprintOn($moment)['number'] ?? null;
    }

    public function shortLabelOn(CarbonInterface $moment): ?string
    {
        $number = $this->numberOn($moment);

        if ($number === null) {
            return null;
        }

        return "S{$number}";
    }

    /**
     * The last retro weekday of the first sprint, from today on, whose retro has not passed yet.
     *
     * @return NextRetro|null
     */
    public function nextRetro(CarbonInterface $now): ?array
    {
        if ($this->retroWeekday === null) {
            return null;
        }

        $local = CarbonImmutable::instance($now)->setTimezone($this->timezone);

        foreach ($this->sprints as $sprint) {
            $retroDay = $this->retroDayOf($sprint);

            if ($retroDay === null) {
                continue;
            }

            if ($this->hasPassed($retroDay, $local)) {
                continue;
            }

            return ['date' => $retroDay->toDateString(), 'time' => $this->retroTime];
        }

        return null;
    }

    private static function timezone(): string
    {
        return (string) config('app.timezone');
    }

    /**
     * @param  Sprint  $sprint
     */
    private function retroDayOf(array $sprint): ?CarbonImmutable
    {
        $firstDay = CarbonImmutable::parse($sprint['startsOn'], $this->timezone)->startOfDay();
        $lastDay = CarbonImmutable::parse($sprint['endsOn'], $this->timezone)->startOfDay();
        $retroDay = $lastDay->subDays(($lastDay->dayOfWeekIso - (int) $this->retroWeekday + 7) % 7);

        if ($retroDay->lessThan($firstDay)) {
            return null;
        }

        return $retroDay;
    }

    private function hasPassed(CarbonImmutable $retroDay, CarbonImmutable $now): bool
    {
        $today = $now->startOfDay();

        if ($retroDay->lessThan($today)) {
            return true;
        }

        if ($retroDay->greaterThan($today)) {
            return false;
        }

        if ($this->retroTime === null) {
            return false;
        }

        return $now->format('H:i') > $this->retroTime;
    }
}
