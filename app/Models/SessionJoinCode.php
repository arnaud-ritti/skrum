<?php

namespace App\Models;

use App\Enums\JoinableSessionKind;
use Database\Factories\SessionJoinCodeFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

/**
 * No foreign key holds the session: five parent tables, some emptied by database cascades that fire no model event.
 * A code whose session is gone is deleted when it is next resolved.
 *
 * @property string $id
 * @property string $code
 * @property JoinableSessionKind $session_kind
 * @property string $session_id
 */
#[Fillable(['code', 'session_kind', 'session_id'])]
class SessionJoinCode extends Model
{
    /** @use HasFactory<SessionJoinCodeFactory> */
    use HasFactory;

    use HasUuids;

    public function session(): Retro|PokerGame|Whiteboard|TeamSurvey|GameRoom|null
    {
        return match ($this->session_kind) {
            JoinableSessionKind::Retro => Retro::query()->find($this->session_id),
            JoinableSessionKind::Poker => PokerGame::query()->find($this->session_id),
            JoinableSessionKind::Whiteboard => Whiteboard::query()->find($this->session_id),
            JoinableSessionKind::Survey => TeamSurvey::query()->find($this->session_id),
            JoinableSessionKind::Game => GameRoom::query()->find($this->session_id),
        };
    }

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'session_kind' => JoinableSessionKind::class,
        ];
    }
}
