<?php

namespace App\Actions\Whiteboards;

use App\Events\Whiteboards\WhiteboardElementsChanged;
use App\Jobs\RefreshWhiteboardPreview;
use App\Models\Whiteboard;
use App\Models\WhiteboardElement;
use App\Models\WhiteboardMember;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/**
 * @phpstan-type Rejection array{id: ?string, reason: string, element: ?array<string, mixed>}
 * @phpstan-type Result array{seq: int, fromSeq: int, rejected: list<Rejection>}
 */
class WriteWhiteboardElements
{
    public const MaxBatch = 200;

    public const MaxBroadcastBytes = 8000;

    public int $maxLiveElements = Whiteboard::MaxLiveElements;

    public function __construct(
        private SanitizeWhiteboardElement $sanitizeWhiteboardElement,
        private PresentWhiteboardElement $presentWhiteboardElement,
        private OrderWhiteboardElements $orderWhiteboardElements,
    ) {}

    /**
     * @param  array<int, mixed>  $rawElements
     * @return Result
     */
    public function handle(Whiteboard $board, WhiteboardMember $member, array $rawElements): array
    {
        return DB::transaction(function () use ($board, $member, $rawElements): array {
            $locked = Whiteboard::query()->whereKey($board->id)->lockForUpdate()->firstOrFail();

            WhiteboardGuard::notLocked($locked, $member);

            $fromSeq = $locked->seq;
            $seq = $fromSeq;
            $isFacilitator = $locked->isFacilitator($member);
            $stored = $this->storedElements($locked, $rawElements);
            $fileIds = $locked->files()->pluck('file_id')->flip();
            $liveCount = $locked->elements()->where('is_deleted', false)->count();
            $accepted = [];
            $rejected = [];

            foreach ($rawElements as $raw) {
                $element = $this->sanitizeWhiteboardElement->handle($raw);

                if ($element === null) {
                    $id = $this->rawId($raw);

                    $rejected[] = $this->rejection($id, 'invalid', $id === null ? null : $stored->get($id));

                    continue;
                }

                $existing = $stored->get($element['id']);

                if ($this->isSameWrite($existing, $element)) {
                    continue;
                }

                $reason = $this->refusal($existing, $element, $isFacilitator, $fileIds, $liveCount);

                if ($reason !== null) {
                    $rejected[] = $this->rejection($element['id'], $reason, $existing);

                    continue;
                }

                $liveCount += $this->liveDelta($existing, $element);
                $seq++;

                $saved = $this->save($locked, $member, $existing, $element, $seq);

                $stored->put($element['id'], $saved);
                $accepted[$element['id']] = $saved;
            }

            if ($seq === $fromSeq) {
                return ['seq' => $seq, 'fromSeq' => $fromSeq, 'rejected' => $rejected];
            }

            $locked->update(['seq' => $seq]);

            dispatch(new RefreshWhiteboardPreview($locked->id))->afterCommit()->delay(now()->addSeconds(30));

            new WhiteboardElementsChanged($locked->id, $seq, $fromSeq, $this->broadcastable($accepted))->sendToOthers();

            return ['seq' => $seq, 'fromSeq' => $fromSeq, 'rejected' => $rejected];
        });
    }

    /**
     * @param  array<int, mixed>  $rawElements
     * @return Collection<string, WhiteboardElement>
     */
    private function storedElements(Whiteboard $board, array $rawElements): Collection
    {
        $ids = collect($rawElements)
            ->map(fn (mixed $raw): ?string => $this->rawId($raw))
            ->filter(fn (?string $id): bool => $id !== null)
            ->unique()
            ->values();

        return $board->elements()->whereIn('element_id', $ids)->get()->keyBy('element_id');
    }

    private function rawId(mixed $raw): ?string
    {
        if (! is_array($raw)) {
            return null;
        }

        $id = $raw['id'] ?? null;

        if (! is_string($id) || preg_match(SanitizeWhiteboardElement::IdPattern, $id) !== 1) {
            return null;
        }

        return $id;
    }

    /**
     * A client retrying after a timeout resends what the server already
     * holds; that is neither a change nor a conflict.
     *
     * @param  array<string, mixed>  $element
     */
    private function isSameWrite(?WhiteboardElement $existing, array $element): bool
    {
        return $existing !== null
            && $existing->version === $element['version']
            && $existing->version_nonce === $element['versionNonce'];
    }

    /**
     * @param  array<string, mixed>  $element
     * @param  Collection<string, int>  $fileIds
     */
    private function refusal(?WhiteboardElement $existing, array $element, bool $isFacilitator, Collection $fileIds, int $liveCount): ?string
    {
        if ($this->isStale($existing, $element)) {
            return 'stale';
        }

        if (! $isFacilitator && $this->touchesLock($existing, $element)) {
            return 'locked';
        }

        if ($element['type'] === 'image' && ! $element['isDeleted'] && ! $fileIds->has($element['fileId'])) {
            return 'file';
        }

        if ($this->liveDelta($existing, $element) > 0 && $liveCount >= $this->maxLiveElements) {
            return 'full';
        }

        return null;
    }

    /**
     * Excalidraw's own rule: the higher version wins, and on a tie the
     * lower nonce, so every client converges on the same copy.
     *
     * @param  array<string, mixed>  $element
     */
    private function isStale(?WhiteboardElement $existing, array $element): bool
    {
        if ($existing === null) {
            return false;
        }

        if ($element['version'] !== $existing->version) {
            return $element['version'] < $existing->version;
        }

        return $element['versionNonce'] > $existing->version_nonce;
    }

    /**
     * @param  array<string, mixed>  $element
     */
    private function touchesLock(?WhiteboardElement $existing, array $element): bool
    {
        return $element['locked'] || (bool) ($existing?->data['locked'] ?? false);
    }

    /**
     * @param  array<string, mixed>  $element
     */
    private function liveDelta(?WhiteboardElement $existing, array $element): int
    {
        $wasLive = $existing !== null && ! $existing->is_deleted;
        $isLive = ! $element['isDeleted'];

        return (int) $isLive - (int) $wasLive;
    }

    /**
     * @param  array<string, mixed>  $element
     */
    private function save(Whiteboard $board, WhiteboardMember $member, ?WhiteboardElement $existing, array $element, int $seq): WhiteboardElement
    {
        $attributes = [
            'type' => $element['type'],
            'data' => $element,
            'version' => $element['version'],
            'version_nonce' => $element['versionNonce'],
            'is_sticky' => isset($element['customData']),
            'is_deleted' => $element['isDeleted'],
            'seq' => $seq,
        ];

        if ($existing !== null) {
            $existing->update($attributes);

            return $existing;
        }

        return $board->elements()->create([
            ...$attributes,
            'element_id' => $element['id'],
            'author_member_id' => $member->id,
        ]);
    }

    /**
     * @return Rejection
     */
    private function rejection(?string $id, string $reason, ?WhiteboardElement $existing): array
    {
        return [
            'id' => $id,
            'reason' => $reason,
            'element' => $existing === null ? null : $this->presentWhiteboardElement->handle($existing),
        ];
    }

    /**
     * @param  array<string, WhiteboardElement>  $accepted
     * @return array<int, array<string, mixed>>|null
     */
    private function broadcastable(array $accepted): ?array
    {
        $elements = $this->orderWhiteboardElements
            ->handle(collect(array_values($accepted)))
            ->map(fn (WhiteboardElement $element): array => $this->presentWhiteboardElement->handle($element))
            ->all();

        if (strlen((string) json_encode($elements)) > self::MaxBroadcastBytes) {
            return null;
        }

        return $elements;
    }
}
