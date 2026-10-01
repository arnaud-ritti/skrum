<?php

namespace App\Actions\Whiteboards;

use App\Events\Whiteboards\WhiteboardChanged;
use App\Models\Whiteboard;
use App\Models\WhiteboardElement;
use App\Models\WhiteboardMember;
use App\Models\WhiteboardVoteSession;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class CloseWhiteboardVote
{
    public const MaxTextLength = 200;

    /**
     * From the close on only totals exist: the per-member votes are deleted
     * with the write that stores the results (spec §11.4).
     */
    public function handle(Whiteboard $board, WhiteboardVoteSession $session, WhiteboardMember $member): void
    {
        DB::transaction(function () use ($board, $session, $member): void {
            $locked = Whiteboard::query()->whereKey($board->id)->lockForUpdate()->firstOrFail();

            WhiteboardGuard::facilitator($locked, $member);

            $open = $locked->voteSessions()->whereKey($session->id)->firstOrFail();

            if (! $open->isOpen()) {
                return;
            }

            $open->update(['results' => $this->results($locked, $open), 'closed_at' => now()]);
            $open->votes()->delete();

            (new WhiteboardChanged($locked->id))->sendToOthers();
        });
    }

    /**
     * @return list<array{elementId: string, text: string, count: int}>
     */
    private function results(Whiteboard $board, WhiteboardVoteSession $session): array
    {
        $totals = $session->votes()
            ->get(['element_id', 'count'])
            ->groupBy('element_id')
            ->map(fn (Collection $votes): int => (int) $votes->sum('count'));

        $notes = $board->elements()
            ->whereIn('element_id', $totals->keys()->map(fn (int|string $id): string => (string) $id)->all())
            ->get()
            ->filter(fn (WhiteboardElement $note): bool => $session->isTarget($note));

        $words = $board->elements()
            ->where('type', 'text')
            ->where('is_deleted', false)
            ->get()
            ->keyBy(fn (WhiteboardElement $text): string => (string) ($text->data['containerId'] ?? ''));

        return array_values($notes
            ->map(fn (WhiteboardElement $note): array => [
                'elementId' => $note->element_id,
                'text' => $this->label($words->get($note->element_id)),
                'count' => (int) $totals->get($note->element_id),
                'x' => (float) ($note->data['x'] ?? 0),
                'y' => (float) ($note->data['y'] ?? 0),
            ])
            ->sort(fn (array $first, array $second): int => [$second['count'], $first['y'], $first['x'], $first['elementId']]
                <=> [$first['count'], $second['y'], $second['x'], $second['elementId']])
            ->map(fn (array $result): array => ['elementId' => $result['elementId'], 'text' => $result['text'], 'count' => $result['count']])
            ->all());
    }

    private function label(?WhiteboardElement $words): string
    {
        $text = $words?->data['originalText'] ?? $words?->data['text'] ?? '';

        return mb_substr(is_string($text) ? $text : '', 0, self::MaxTextLength);
    }
}
