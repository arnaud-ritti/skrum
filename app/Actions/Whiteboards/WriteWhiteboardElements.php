<?php

namespace App\Actions\Whiteboards;

use App\Events\Whiteboards\WhiteboardElementsChanged;
use App\Events\Whiteboards\WhiteboardVoteChanged;
use App\Models\Whiteboard;
use App\Models\WhiteboardElement;
use App\Models\WhiteboardMember;
use App\Models\WhiteboardVoteSession;
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
        private PresentWhiteboardVoting $presentWhiteboardVoting,
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
            $session = $locked->voteSessions()->whereNull('closed_at')->first();
            $stored = $this->storedElements($locked, $rawElements, $session !== null);
            $targetsBefore = $this->targets($session, $stored);
            $leftScope = 0;
            $fileIds = $locked->files()->pluck('file_id')->flip();
            $liveCount = $locked->elements()->where('is_deleted', false)->count();
            $accepted = [];
            $rejected = [];

            $queue = array_map(fn (mixed $raw): array => [$raw, true], array_values($rawElements));

            while ($queue !== []) {
                [$raw, $mayDefer] = array_shift($queue);

                $element = $this->sanitizeWhiteboardElement->handle($raw);

                if ($element === null) {
                    $id = $this->rawId($raw);

                    $rejected[] = $this->rejection($id, 'invalid', $id === null ? null : $stored->get($id), $member);

                    continue;
                }

                $existing = $stored->get($element['id']);

                if ($this->isSameWrite($existing, $element)) {
                    continue;
                }

                if ($mayDefer && $this->isWordsOfTarget($existing, $element, $targetsBefore)) {
                    $queue[] = [$raw, false];

                    continue;
                }

                $reason = $this->refusal($existing, $element, $isFacilitator, $fileIds, $liveCount);

                if ($reason === null && ! $mayDefer && $session !== null && $this->changesWordsOfTarget($session, $stored, $targetsBefore, $existing, $element)) {
                    $reason = 'voting';
                }

                if ($reason === null && $session !== null && $this->rebindsWordsOfTarget($targetsBefore, $existing, $element)) {
                    $reason = 'voting';
                }

                if ($reason !== null) {
                    $rejected[] = $this->rejection($element['id'], $reason, $existing, $member);

                    continue;
                }

                $liveCount += $this->liveDelta($existing, $element);
                $seq++;

                $saved = $this->save($locked, $member, $existing, $element, $seq);

                $stored->put($element['id'], $saved);
                $accepted[$element['id']] = $saved;

                if ($session !== null && isset($targetsBefore[$element['id']]) && ! $session->isTarget($saved)) {
                    $session->votes()->where('element_id', $element['id'])->delete();

                    $leftScope++;
                }
            }

            if ($seq === $fromSeq) {
                return ['seq' => $seq, 'fromSeq' => $fromSeq, 'rejected' => $rejected];
            }

            $locked->update(['seq' => $seq]);

            (new WhiteboardElementsChanged($locked->id, $seq, $fromSeq, $this->broadcastable($accepted)))->sendToOthers();

            if ($session !== null && $leftScope > 0) {
                (new WhiteboardVoteChanged($locked->id, $session->id, $this->presentWhiteboardVoting->finishedCount($session)))->sendToAll();
            }

            return ['seq' => $seq, 'fromSeq' => $fromSeq, 'rejected' => $rejected];
        });
    }

    /**
     * @param  array<int, mixed>  $rawElements
     * @return Collection<string, WhiteboardElement>
     */
    private function storedElements(Whiteboard $board, array $rawElements, bool $withContainers): Collection
    {
        $ids = collect($rawElements)
            ->map(fn (mixed $raw): ?string => $this->rawId($raw))
            ->filter(fn (?string $id): bool => $id !== null)
            ->unique()
            ->values();

        $stored = $board->elements()->whereIn('element_id', $ids)->get()->keyBy('element_id');

        if (! $withContainers) {
            return $stored;
        }

        $containerIds = collect($rawElements)
            ->map(fn (mixed $raw): mixed => is_array($raw) ? ($raw['containerId'] ?? null) : null)
            ->merge($stored->map(fn (WhiteboardElement $element): mixed => $element->data['containerId'] ?? null)->values())
            ->filter(fn (mixed $id): bool => is_string($id) && preg_match(SanitizeWhiteboardElement::IdPattern, $id) === 1 && ! $stored->has($id))
            ->unique()
            ->values();

        if ($containerIds->isEmpty()) {
            return $stored;
        }

        return $stored->union($board->elements()->whereIn('element_id', $containerIds)->get()->keyBy('element_id'));
    }

    /**
     * @param  Collection<string, WhiteboardElement>  $stored
     * @return array<int|string, true>
     */
    private function targets(?WhiteboardVoteSession $session, Collection $stored): array
    {
        if ($session === null) {
            return [];
        }

        $targets = [];

        foreach ($stored as $element) {
            if ($session->isTarget($element)) {
                $targets[$element->element_id] = true;
            }
        }

        return $targets;
    }

    /**
     * @param  array<string, mixed>  $element
     * @return list<string>
     */
    private function containerIds(?WhiteboardElement $existing, array $element): array
    {
        return array_values(array_unique(array_filter(
            [$element['containerId'] ?? null, $existing?->data['containerId'] ?? null],
            fn (mixed $id): bool => is_string($id),
        )));
    }

    /**
     * @param  array<string, mixed>  $element
     * @param  array<int|string, true>  $targetsBefore
     */
    private function isWordsOfTarget(?WhiteboardElement $existing, array $element, array $targetsBefore): bool
    {
        if ($element['type'] !== 'text' && $existing?->type !== 'text') {
            return false;
        }

        foreach ($this->containerIds($existing, $element) as $containerId) {
            if (isset($targetsBefore[$containerId])) {
                return true;
            }
        }

        return false;
    }

    /**
     * @param  Collection<string, WhiteboardElement>  $stored
     * @param  array<int|string, true>  $targetsBefore
     * @param  array<string, mixed>  $element
     */
    private function changesWordsOfTarget(WhiteboardVoteSession $session, Collection $stored, array $targetsBefore, ?WhiteboardElement $existing, array $element): bool
    {
        $underVote = false;

        foreach ($this->containerIds($existing, $element) as $containerId) {
            if (isset($targetsBefore[$containerId]) && $session->isTarget($stored->get($containerId))) {
                $underVote = true;
            }
        }

        if (! $underVote) {
            return false;
        }

        if ($existing === null) {
            return true;
        }

        if ($existing->type !== $element['type']) {
            return true;
        }

        $before = $existing->data;

        return $this->letters($before['text'] ?? null) !== $this->letters($element['text'] ?? null)
            || $this->letters($before['originalText'] ?? $before['text'] ?? null) !== $this->letters($element['originalText'] ?? $element['text'] ?? null)
            || ($before['containerId'] ?? null) !== ($element['containerId'] ?? null)
            || $existing->is_deleted !== $element['isDeleted'];
    }

    /**
     * A note that stays under vote keeps the text it holds: the canvas
     * rewrites the note's list when its words are cleared or first typed,
     * and that half of the batch must not be stored without the other.
     *
     * @param  array<int|string, true>  $targetsBefore
     * @param  array<string, mixed>  $element
     */
    private function rebindsWordsOfTarget(array $targetsBefore, ?WhiteboardElement $existing, array $element): bool
    {
        if ($existing === null || ! isset($targetsBefore[$element['id']])) {
            return false;
        }

        if ($element['isDeleted'] || ! isset($element['customData'])) {
            return false;
        }

        return $this->boundTextIds($existing->data) !== $this->boundTextIds($element);
    }

    /**
     * @param  array<string, mixed>  $element
     * @return list<string>
     */
    private function boundTextIds(array $element): array
    {
        $bound = $element['boundElements'] ?? null;

        if (! is_array($bound)) {
            return [];
        }

        $ids = [];

        foreach ($bound as $entry) {
            if (is_array($entry) && ($entry['type'] ?? null) === 'text' && is_string($entry['id'] ?? null)) {
                $ids[] = $entry['id'];
            }
        }

        $ids = array_values(array_unique($ids));

        sort($ids);

        return $ids;
    }

    private function letters(mixed $text): string
    {
        return (string) preg_replace('/\s+/u', '', is_string($text) ? $text : '');
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
    private function rejection(?string $id, string $reason, ?WhiteboardElement $existing, WhiteboardMember $member): array
    {
        return [
            'id' => $id,
            'reason' => $reason,
            'element' => $existing === null ? null : $this->presentWhiteboardElement->handle($existing, $member),
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
            ->map(fn (WhiteboardElement $element): array => $element->data)
            ->all();

        if (strlen((string) json_encode($elements)) > self::MaxBroadcastBytes) {
            return null;
        }

        return $elements;
    }
}
