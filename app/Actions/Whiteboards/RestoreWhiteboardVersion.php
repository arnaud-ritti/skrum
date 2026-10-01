<?php

namespace App\Actions\Whiteboards;

use App\Events\Whiteboards\WhiteboardChanged;
use App\Events\Whiteboards\WhiteboardElementsChanged;
use App\Models\Whiteboard;
use App\Models\WhiteboardElement;
use App\Models\WhiteboardMember;
use App\Models\WhiteboardVersion;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class RestoreWhiteboardVersion
{
    private const IdLength = 20;

    private const MaxNonce = 2147483647;

    public function __construct(
        private StoreWhiteboardVersion $storeWhiteboardVersion,
        private SanitizeWhiteboardElement $sanitizeWhiteboardElement,
        private ScheduleWhiteboardVersion $scheduleWhiteboardVersion,
        private KeepWhiteboardTextOutOfLogs $keepWhiteboardTextOutOfLogs,
        private ReadWhiteboardVersion $readWhiteboardVersion,
    ) {}

    public function handle(Whiteboard $board, WhiteboardMember $member, WhiteboardVersion $version): void
    {
        $this->keepWhiteboardTextOutOfLogs->handle($board->id, fn () => DB::transaction(function () use ($board, $member, $version): void {
            $locked = Whiteboard::query()->whereKey($board->id)->lockForUpdate()->firstOrFail();

            WhiteboardGuard::facilitator($locked, $member);
            WhiteboardGuard::notPrivateWriting($locked);

            $chosen = $locked->versions()->whereKey($version->id)->firstOrFail();

            $this->storeWhiteboardVersion->handle($locked, $member, $this->safetyName());

            $fromSeq = $locked->seq;
            $seq = $this->rewrite($locked, $member, $chosen, $fromSeq);

            $this->endVoting($locked);

            if ($seq !== $fromSeq) {
                $locked->update(['seq' => $seq]);

                (new WhiteboardElementsChanged($locked->id, $seq, $fromSeq, null))->sendToOthers();

                $this->scheduleWhiteboardVersion->handle($locked, $fromSeq);
            }

            (new WhiteboardChanged($locked->id))->sendToOthers();
        }));
    }

    /**
     * The notes a vote counted may be gone or changed (spec §9): an open
     * session ends without results, and no closed session keeps its badges.
     */
    private function endVoting(Whiteboard $locked): void
    {
        $open = $locked->voteSessions()->whereNull('closed_at')->first();

        $open?->votes()->delete();
        $open?->update(['results' => [], 'closed_at' => now()]);

        $locked->voteSessions()->whereNull('dismissed_at')->update(['dismissed_at' => now()]);
    }

    private function safetyName(): string
    {
        return __('Before restore · :date', ['date' => now()->settings(['locale' => app()->getLocale()])->isoFormat('LL LT')]);
    }

    /**
     * Writes the elements of the version over the board and tombstones the
     * rest. Returns the last seq given.
     */
    private function rewrite(Whiteboard $locked, WhiteboardMember $member, WhiteboardVersion $chosen, int $seq): int
    {
        $rows = $locked->elements()->get()->keyBy('element_id');
        $elements = $this->restorable($locked, $chosen);
        $freshIds = $this->freshIds($elements, $rows);
        $updated = (int) now()->getTimestampMs();
        $restored = [];

        foreach ($elements as $element) {
            $renamed = $this->renamed($element, $freshIds);
            $existing = isset($freshIds[$element['id']]) ? null : $rows->get($element['id']);
            $restored[$renamed['id']] = true;

            if ($existing !== null && ($this->cannotBeRewritten($existing) || $this->isUnchanged($existing, $renamed))) {
                continue;
            }

            $seq++;

            $this->write($locked, $member, $existing, [
                ...$renamed,
                'version' => $this->nextVersion($existing, $renamed),
                'versionNonce' => random_int(1, self::MaxNonce),
                'updated' => $updated,
            ], $seq);
        }

        foreach ($rows as $row) {
            if ($row->is_deleted || isset($restored[$row->element_id]) || $this->cannotBeRewritten($row)) {
                continue;
            }

            $seq++;

            $this->write($locked, $member, $row, [
                ...$row->data,
                'isDeleted' => true,
                'version' => $row->version + 1,
                'versionNonce' => random_int(1, self::MaxNonce),
                'updated' => $updated,
            ], $seq);
        }

        return $seq;
    }

    /**
     * What the board would accept today: an image whose file is no longer
     * stored is left out, as the copy path does.
     *
     * @return list<array<string, mixed>>
     */
    private function restorable(Whiteboard $locked, WhiteboardVersion $chosen): array
    {
        $fileIds = $locked->files()->pluck('file_id')->flip();
        $elements = [];

        foreach ($this->readWhiteboardVersion->handle($chosen) as $raw) {
            $element = $this->sanitizeWhiteboardElement->handle($raw);

            if ($element === null || $element['isDeleted']) {
                continue;
            }

            if ($element['type'] === 'image' && ! $fileIds->has($element['fileId'])) {
                continue;
            }

            $elements[] = $element;
        }

        return $elements;
    }

    /**
     * An element whose row is gone (its tombstone was purged) or is a
     * tombstone no version can outrank comes back under a new id: a browser
     * left open may still hold the old tombstone at a higher version and
     * would delete the element again under its old id.
     *
     * @param  list<array<string, mixed>>  $elements
     * @param  Collection<string, WhiteboardElement>  $rows
     * @return array<string, string>
     */
    private function freshIds(array $elements, Collection $rows): array
    {
        $ids = [];

        foreach ($elements as $element) {
            $row = $rows->get($element['id']);

            if ($row === null || ($row->is_deleted && $this->cannotBeRewritten($row))) {
                $ids[$element['id']] = Str::random(self::IdLength);
            }
        }

        return $ids;
    }

    /**
     * @param  array<string, mixed>  $element
     * @param  array<string, string>  $ids
     * @return array<string, mixed>
     */
    private function renamed(array $element, array $ids): array
    {
        $element['id'] = $ids[$element['id']] ?? $element['id'];

        foreach (['frameId', 'containerId'] as $key) {
            if (is_string($element[$key] ?? null)) {
                $element[$key] = $ids[$element[$key]] ?? $element[$key];
            }
        }

        foreach (['startBinding', 'endBinding'] as $key) {
            if (is_array($element[$key] ?? null)) {
                $element[$key]['elementId'] = $ids[$element[$key]['elementId']] ?? $element[$key]['elementId'];
            }
        }

        if (is_array($element['boundElements'] ?? null)) {
            $element['boundElements'] = array_map(
                fn (array $bound): array => [...$bound, 'id' => $ids[$bound['id']] ?? $bound['id']],
                $element['boundElements'],
            );
        }

        return $element;
    }

    private function cannotBeRewritten(WhiteboardElement $row): bool
    {
        return $row->version >= SanitizeWhiteboardElement::MaxVersion;
    }

    /**
     * @param  array<string, mixed>  $element
     */
    private function isUnchanged(WhiteboardElement $existing, array $element): bool
    {
        return ! $existing->is_deleted
            && $existing->version === $element['version']
            && $existing->version_nonce === $element['versionNonce']
            && $existing->data == $element;
    }

    /**
     * @param  array<string, mixed>  $element
     */
    private function nextVersion(?WhiteboardElement $existing, array $element): int
    {
        if ($existing === null) {
            return 1;
        }

        return min(SanitizeWhiteboardElement::MaxVersion, max($existing->version, $element['version']) + 1);
    }

    /**
     * @param  array<string, mixed>  $element
     */
    private function write(Whiteboard $locked, WhiteboardMember $member, ?WhiteboardElement $existing, array $element, int $seq): void
    {
        $attributes = [
            'type' => $element['type'],
            'data' => $element,
            'version' => $element['version'],
            'version_nonce' => $element['versionNonce'],
            'is_sticky' => isset($element['customData']),
            'is_private' => false,
            'is_deleted' => $element['isDeleted'],
            'seq' => $seq,
        ];

        if ($existing !== null) {
            $existing->update($attributes);

            return;
        }

        $locked->elements()->create([
            ...$attributes,
            'element_id' => $element['id'],
            'author_member_id' => $member->id,
        ]);
    }
}
