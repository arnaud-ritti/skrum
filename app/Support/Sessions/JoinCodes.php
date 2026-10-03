<?php

namespace App\Support\Sessions;

use App\Enums\GameRoomAccess;
use App\Enums\JoinableSessionKind;
use App\Enums\TeamSurveyStatus;
use App\Models\GameRoom;
use App\Models\PokerGame;
use App\Models\Retro;
use App\Models\SessionJoinCode;
use App\Models\TeamSurvey;
use App\Models\Whiteboard;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;
use RuntimeException;

/**
 * A session's code is issued the first time someone who may share its link
 * sees it, and replaced with the link. It leads to the join page only while
 * that page would accept a guest.
 *
 * Two first issues at once meet on the unique (session_kind, session_id) pair:
 * the losing insert, in its own nested transaction, re-reads the winner's code.
 */
class JoinCodes
{
    private const int Attempts = 5;

    public function for(Retro|PokerGame|Whiteboard|TeamSurvey|GameRoom $session): string
    {
        $kind = self::kindOf($session);

        for ($attempt = 1; $attempt <= self::Attempts; $attempt++) {
            $existing = $this->codeOf($kind, $session->id);

            if ($existing !== null) {
                return $existing;
            }

            try {
                return DB::transaction(fn (): string => SessionJoinCode::query()->create([
                    'code' => JoinCode::generate(),
                    'session_kind' => $kind,
                    'session_id' => $session->id,
                ])->code);
            } catch (UniqueConstraintViolationException) {
                continue;
            }
        }

        throw new RuntimeException('No join code could be issued.');
    }

    public function rotate(Retro|PokerGame|Whiteboard|TeamSurvey|GameRoom $session): string
    {
        $kind = self::kindOf($session);

        for ($attempt = 1; $attempt <= self::Attempts; $attempt++) {
            try {
                return DB::transaction(fn (): string => SessionJoinCode::query()->updateOrCreate(
                    ['session_kind' => $kind, 'session_id' => $session->id],
                    ['code' => JoinCode::generate()],
                )->code);
            } catch (UniqueConstraintViolationException) {
                continue;
            }
        }

        throw new RuntimeException('No join code could be issued.');
    }

    /**
     * The join page the code leads to, or null for a code that is malformed,
     * unknown, or whose session no longer accepts guests.
     */
    public function resolve(string $input): ?string
    {
        $code = JoinCode::normalise($input);

        if ($code === null) {
            return null;
        }

        $row = SessionJoinCode::query()->where('code', $code)->first();

        if ($row === null) {
            return null;
        }

        $session = $row->session();

        if ($session === null) {
            $row->delete();

            return null;
        }

        return $this->joinUrl($session);
    }

    private function joinUrl(Retro|PokerGame|Whiteboard|TeamSurvey|GameRoom $session): ?string
    {
        return match (true) {
            $session instanceof Retro => $session->guest_access_enabled ? route('retros.join.show', $session->guest_token) : null,
            $session instanceof PokerGame => $session->guest_access_enabled ? route('poker.join.show', $session->guest_token) : null,
            $session instanceof Whiteboard => $session->guest_access_enabled ? route('whiteboards.join.show', $session->guest_token) : null,
            $session instanceof TeamSurvey => $session->guest_access_enabled && $session->status !== TeamSurveyStatus::Draft && $session->retro_id === null
                ? route('surveys.join.show', $session->guest_token)
                : null,
            $session instanceof GameRoom => $session->retro_id === null && $session->access === GameRoomAccess::Link ? $session->guestUrl() : null,
        };
    }

    private function codeOf(JoinableSessionKind $kind, string $sessionId): ?string
    {
        $code = SessionJoinCode::query()->where('session_kind', $kind)->where('session_id', $sessionId)->value('code');

        return is_string($code) ? $code : null;
    }

    private static function kindOf(Retro|PokerGame|Whiteboard|TeamSurvey|GameRoom $session): JoinableSessionKind
    {
        return match (true) {
            $session instanceof Retro => JoinableSessionKind::Retro,
            $session instanceof PokerGame => JoinableSessionKind::Poker,
            $session instanceof Whiteboard => JoinableSessionKind::Whiteboard,
            $session instanceof TeamSurvey => JoinableSessionKind::Survey,
            $session instanceof GameRoom => JoinableSessionKind::Game,
        };
    }
}
