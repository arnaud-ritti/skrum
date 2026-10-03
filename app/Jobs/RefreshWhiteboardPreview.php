<?php

namespace App\Jobs;

use App\Actions\Whiteboards\OrderWhiteboardElements;
use App\Actions\Whiteboards\PresentWhiteboardPreview;
use App\Models\Whiteboard;
use App\Models\WhiteboardElement;
use Illuminate\Contracts\Queue\ShouldBeUniqueUntilProcessing;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;

/**
 * Builds a board's thumbnail with the template gallery's renderer. One per board waits at
 * a time; when it runs it reads the board as it is then, and a write made while it runs
 * queues the next one.
 */
class RefreshWhiteboardPreview implements ShouldBeUniqueUntilProcessing, ShouldQueue
{
    use Queueable;

    public int $uniqueFor = 120;

    public function __construct(public string $whiteboardId) {}

    public function uniqueId(): string
    {
        return $this->whiteboardId;
    }

    public function handle(OrderWhiteboardElements $orderWhiteboardElements, PresentWhiteboardPreview $presentWhiteboardPreview): void
    {
        $board = Whiteboard::query()->find($this->whiteboardId);

        if ($board === null) {
            return;
        }

        if ($board->preview_seq === $board->seq) {
            return;
        }

        $seq = $board->seq;
        $elements = $orderWhiteboardElements
            ->handle($board->elements()->where('is_deleted', false)->get())
            ->map(fn (WhiteboardElement $element): array => $element->data)
            ->values()
            ->all();

        $board->timestamps = false;
        $board->forceFill([
            'preview' => $presentWhiteboardPreview->handle($elements),
            'preview_seq' => $seq,
        ])->save();
    }
}
