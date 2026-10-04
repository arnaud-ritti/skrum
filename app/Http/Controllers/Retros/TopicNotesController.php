<?php

namespace App\Http\Controllers\Retros;

use App\Actions\Retros\PresentTopicNote;
use App\Actions\Retros\RetroGuard;
use App\Enums\RetroPhase;
use App\Events\Retros\TopicNoteSaved;
use App\Http\Controllers\Controller;
use App\Models\Card;
use App\Models\Participant;
use App\Models\Retro;
use App\Models\TopicNote;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * The shared notes of a topic. A save names the version it started from; a
 * save from an older version writes nothing and gets the current note back.
 */
class TopicNotesController extends Controller
{
    public function __construct(private PresentTopicNote $presentTopicNote) {}

    public function update(Request $request, Retro $retro, Card $card): JsonResponse
    {
        $participant = Participant::current($request);

        RetroGuard::phase($retro, RetroPhase::Discussing);
        RetroGuard::unlocked($retro);

        $validated = $request->validate([
            'body' => ['present', 'nullable', 'string', 'max:'.TopicNote::MaxLength],
            'version' => ['required', 'integer', 'min:0'],
        ]);

        $outcome = DB::transaction(function () use ($retro, $card, $participant, $validated): array {
            $locked = Retro::query()->whereKey($retro->id)->lockForUpdate()->firstOrFail();

            RetroGuard::phase($locked, RetroPhase::Discussing);
            RetroGuard::unlocked($locked);

            $topic = $locked->cards()->whereKey($card->id)->firstOrFail();

            if (! $topic->isTopLevel()) {
                throw ValidationException::withMessages(['card' => __('Notes belong to a topic, not to a card inside a group.')]);
            }

            $note = $locked->topicNotes()->where('card_id', $topic->id)->lockForUpdate()->first();
            $current = $note === null ? 0 : $note->version;

            if ((int) $validated['version'] !== $current) {
                return ['saved' => false, 'note' => $this->presentTopicNote->handle($note, $topic->id)];
            }

            $note ??= new TopicNote(['card_id' => $topic->id]);

            $note->fill([
                'body' => (string) ($validated['body'] ?? ''),
                'version' => $current + 1,
                'updated_by_participant_id' => $participant->id,
            ]);

            $locked->topicNotes()->save($note);

            $presented = $this->presentTopicNote->handle($note, $topic->id);

            new TopicNoteSaved($locked->id, $presented)->sendToOthers();

            return ['saved' => true, 'note' => $presented];
        });

        if (! $outcome['saved']) {
            return response()->json(['message' => __('Someone else changed these notes.'), 'note' => $outcome['note']], 409);
        }

        return response()->json(['note' => $outcome['note']]);
    }
}
