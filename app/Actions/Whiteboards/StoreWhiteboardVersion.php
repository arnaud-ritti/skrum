<?php

namespace App\Actions\Whiteboards;

use App\Models\Whiteboard;
use App\Models\WhiteboardMember;
use App\Models\WhiteboardVersion;

class StoreWhiteboardVersion
{
    public function __construct(
        private ReadWhiteboardScene $readWhiteboardScene,
        private KeepWhiteboardTextOutOfLogs $keepWhiteboardTextOutOfLogs,
    ) {}

    /**
     * The caller holds the lock on the board row. A null name is an
     * automatic version; the cap of named versions is the caller's concern.
     */
    public function handle(Whiteboard $locked, ?WhiteboardMember $member, ?string $name): WhiteboardVersion
    {
        $elements = $this->readWhiteboardScene->handle($locked)['elements'];

        $version = $this->keepWhiteboardTextOutOfLogs->handle($locked->id, fn (): WhiteboardVersion => $locked->versions()->create([
            'name' => $name,
            'scene' => ['elements' => $elements, 'fileIds' => $this->fileIds($elements)],
            'private_element_ids' => $this->privateElementIds($locked),
            'seq' => $locked->seq,
            'created_by_member_id' => $member?->id,
        ]));

        $this->rememberHowFar($locked);

        if ($name === null) {
            $this->forgetOldAutomaticVersions($locked);
        }

        return $version;
    }

    /**
     * @param  list<array<string, mixed>>  $elements
     * @return list<string>
     */
    private function fileIds(array $elements): array
    {
        return array_values(collect($elements)
            ->where('type', 'image')
            ->pluck('fileId')
            ->filter(fn (mixed $fileId): bool => is_string($fileId))
            ->unique()
            ->all());
    }

    /**
     * @return list<string>
     */
    private function privateElementIds(Whiteboard $locked): array
    {
        return array_values($locked->elements()
            ->where('is_private', true)
            ->where('is_deleted', false)
            ->orderBy('element_id')
            ->pluck('element_id')
            ->all());
    }

    /**
     * Written through the base query: `updated_at` is the sort key of the
     * team page and a version is not a change of the board.
     */
    private function rememberHowFar(Whiteboard $locked): void
    {
        Whiteboard::query()->whereKey($locked->id)->toBase()->update(['last_versioned_seq' => $locked->seq]);

        $locked->last_versioned_seq = $locked->seq;
        $locked->syncOriginalAttribute('last_versioned_seq');
    }

    private function forgetOldAutomaticVersions(Whiteboard $locked): void
    {
        $kept = $locked->versions()
            ->whereNull('name')
            ->orderByDesc('seq')
            ->orderByDesc('created_at')
            ->limit(WhiteboardVersion::KeptAutomatic)
            ->pluck('id');

        $locked->versions()->whereNull('name')->whereNotIn('id', $kept)->delete();
    }
}
