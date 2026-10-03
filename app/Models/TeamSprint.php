<?php

namespace App\Models;

use App\Casts\DateOnly;
use Carbon\CarbonInterface;
use Database\Factories\TeamSprintFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property string $id
 * @property string $team_id
 * @property int $number
 * @property CarbonInterface $starts_on
 * @property CarbonInterface $ends_on
 * @property-read Team $team
 */
#[Fillable(['number', 'starts_on', 'ends_on'])]
class TeamSprint extends Model
{
    /** @use HasFactory<TeamSprintFactory> */
    use HasFactory;

    use HasUuids;

    /** @return BelongsTo<Team, $this> */
    public function team(): BelongsTo
    {
        return $this->belongsTo(Team::class);
    }

    /**
     * @return array{id: string, number: int, startsOn: string, endsOn: string}
     */
    public function present(): array
    {
        return [
            'id' => $this->id,
            'number' => $this->number,
            'startsOn' => $this->starts_on->toDateString(),
            'endsOn' => $this->ends_on->toDateString(),
        ];
    }

    protected function casts(): array
    {
        return [
            'number' => 'integer',
            'starts_on' => DateOnly::class,
            'ends_on' => DateOnly::class,
        ];
    }
}
