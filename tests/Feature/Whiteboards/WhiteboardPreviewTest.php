<?php

use App\Actions\Teams\RefreshStaleWhiteboardPreviews;
use App\Actions\Whiteboards\OrderWhiteboardElements;
use App\Actions\Whiteboards\PresentWhiteboardPreview;
use App\Actions\Whiteboards\PresentWhiteboardSummary;
use App\Jobs\RefreshWhiteboardPreview;
use App\Models\Team;
use App\Models\Whiteboard;
use App\Models\WhiteboardElement;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Str;

function refreshWhiteboardPreview(string $whiteboardId): void
{
    new RefreshWhiteboardPreview($whiteboardId)->handle(
        resolve(OrderWhiteboardElements::class),
        resolve(PresentWhiteboardPreview::class),
    );
}

it('builds the preview from the live elements without moving the edited date', function () {
    $board = Whiteboard::factory()->create(['seq' => 3, 'updated_at' => now()->subDays(2)]);
    WhiteboardElement::factory()->for($board)->create(['data' => ['id' => 'a', 'type' => 'rectangle', 'x' => 10, 'y' => 20, 'width' => 40, 'height' => 30, 'backgroundColor' => '#ffd966', 'strokeColor' => '#1e1e1e']]);
    WhiteboardElement::factory()->for($board)->create(['is_deleted' => true, 'data' => ['id' => 'b', 'type' => 'ellipse', 'x' => 0, 'y' => 0, 'width' => 5, 'height' => 5]]);
    $editedAt = $board->fresh()->updated_at->toIso8601String();

    refreshWhiteboardPreview($board->id);

    $board->refresh();

    expect($board->preview_seq)->toBe(3)
        ->and($board->preview['shapes'])->toHaveCount(1)
        ->and($board->preview['shapes'][0])->toMatchArray(['kind' => 'rect', 'x' => 0, 'y' => 0, 'width' => 40, 'height' => 30, 'fill' => '#ffd966'])
        ->and($board->updated_at->toIso8601String())->toBe($editedAt);
});

it('queues a refresh when elements are written', function () {
    Queue::fake();
    $board = Whiteboard::factory()->create();
    [$user] = whiteboardFacilitator($board);

    $this->actingAs($user)->putJson(route('whiteboards.elements.update', $board), [
        'elements' => [sceneElement(['id' => 'a1'])],
    ])->assertOk();

    Queue::assertPushed(RefreshWhiteboardPreview::class, fn (RefreshWhiteboardPreview $job): bool => $job->whiteboardId === $board->id);
});

it('keeps the preview in the summary of a board and queues the boards whose preview is stale', function () {
    Queue::fake();
    $team = Team::factory()->create();
    $fresh = Whiteboard::factory()->for($team)->create(['seq' => 2, 'preview_seq' => 2, 'preview' => ['width' => 1, 'height' => 1, 'shapes' => []]]);
    $stale = Whiteboard::factory()->for($team)->create(['seq' => 5, 'preview_seq' => null]);

    $viewer = teamMember($team);
    $summary = fn (Whiteboard $board): array => resolve(PresentWhiteboardSummary::class)->handle($board, $viewer, false);

    resolve(RefreshStaleWhiteboardPreviews::class)->handle([$fresh, $stale]);

    expect($summary($fresh)['preview'])->not->toBeNull()
        ->and($summary($stale)['preview'])->toBeNull();

    Queue::assertPushed(RefreshWhiteboardPreview::class, 1);
    Queue::assertPushed(RefreshWhiteboardPreview::class, fn (RefreshWhiteboardPreview $job): bool => $job->whiteboardId === $stale->id);
});

it('does nothing for a board that is gone or already up to date', function () {
    $board = Whiteboard::factory()->create(['seq' => 2, 'preview_seq' => 2, 'preview' => ['width' => 1, 'height' => 1, 'shapes' => []]]);

    refreshWhiteboardPreview((string) Str::uuid7());
    refreshWhiteboardPreview($board->id);

    expect($board->fresh()->preview)->toBeIgnoringKeyOrder(['width' => 1, 'height' => 1, 'shapes' => []]);
});
