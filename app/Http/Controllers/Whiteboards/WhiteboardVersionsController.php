<?php

namespace App\Http\Controllers\Whiteboards;

use App\Actions\Whiteboards\PresentWhiteboardVersion;
use App\Actions\Whiteboards\ReadWhiteboardVersion;
use App\Actions\Whiteboards\StoreWhiteboardVersion;
use App\Actions\Whiteboards\WhiteboardGuard;
use App\Http\Controllers\Controller;
use App\Models\Whiteboard;
use App\Models\WhiteboardFile;
use App\Models\WhiteboardMember;
use App\Models\WhiteboardVersion;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class WhiteboardVersionsController extends Controller
{
    private const NameRules = ['required', 'string', 'max:80'];

    public function index(Request $request, Whiteboard $board, PresentWhiteboardVersion $presentWhiteboardVersion): JsonResponse
    {
        WhiteboardGuard::notGuest(WhiteboardMember::current($request));
        WhiteboardGuard::notPrivateWriting($board);

        return response()->json(
            $board->versions()
                ->select(['id', 'whiteboard_id', 'name', 'seq', 'created_by_member_id', 'created_at'])
                ->with('createdBy.user')
                ->orderByDesc('created_at')
                ->orderByDesc('seq')
                ->orderByDesc('id')
                ->get()
                ->map(fn (WhiteboardVersion $version): array => $presentWhiteboardVersion->handle($version))
                ->all(),
        );
    }

    public function store(
        Request $request,
        Whiteboard $board,
        StoreWhiteboardVersion $storeWhiteboardVersion,
        PresentWhiteboardVersion $presentWhiteboardVersion,
    ): JsonResponse {
        $member = WhiteboardMember::current($request);

        WhiteboardGuard::notGuest($member);

        $validated = $request->validate(['name' => self::NameRules]);

        $version = DB::transaction(function () use ($board, $member, $validated, $storeWhiteboardVersion): WhiteboardVersion {
            $locked = Whiteboard::query()->whereKey($board->id)->lockForUpdate()->firstOrFail();

            $this->ensureRoomForNamedVersion($locked);

            return $storeWhiteboardVersion->handle($locked, $member, $validated['name']);
        });

        return response()->json($presentWhiteboardVersion->handle($version), 201);
    }

    public function show(Request $request, Whiteboard $board, WhiteboardVersion $version, ReadWhiteboardVersion $readWhiteboardVersion): JsonResponse
    {
        WhiteboardGuard::notGuest(WhiteboardMember::current($request));
        WhiteboardGuard::notPrivateWriting($board);

        return response()->json([
            'elements' => $readWhiteboardVersion->handle($version),
            'files' => $board->files()
                ->whereIn('file_id', $version->scene['fileIds'])
                ->orderBy('file_id')
                ->get()
                ->map(fn (WhiteboardFile $file): array => [
                    'id' => $file->file_id,
                    'url' => route('whiteboards.files.show', [$board, $file->file_id], absolute: false),
                    'mimeType' => $file->mime_type,
                ])
                ->all(),
        ]);
    }

    public function update(Request $request, Whiteboard $board, WhiteboardVersion $version): Response
    {
        $member = WhiteboardMember::current($request);

        WhiteboardGuard::notGuest($member);
        WhiteboardGuard::facilitator($board, $member);

        $validated = $request->validate(['name' => self::NameRules]);

        DB::transaction(function () use ($board, $member, $version, $validated): void {
            $locked = Whiteboard::query()->whereKey($board->id)->lockForUpdate()->firstOrFail();

            WhiteboardGuard::facilitator($locked, $member);

            $chosen = $locked->versions()->whereKey($version->id)->firstOrFail();

            if ($chosen->isAutomatic()) {
                $this->ensureRoomForNamedVersion($locked);
            }

            $chosen->update(['name' => $validated['name']]);
        });

        return response()->noContent();
    }

    public function destroy(Request $request, Whiteboard $board, WhiteboardVersion $version): Response
    {
        $member = WhiteboardMember::current($request);

        WhiteboardGuard::notGuest($member);
        WhiteboardGuard::facilitator($board, $member);

        DB::transaction(function () use ($board, $member, $version): void {
            $locked = Whiteboard::query()->whereKey($board->id)->lockForUpdate()->firstOrFail();

            WhiteboardGuard::facilitator($locked, $member);

            $locked->versions()->whereKey($version->id)->delete();
        });

        return response()->noContent();
    }

    private function ensureRoomForNamedVersion(Whiteboard $locked): void
    {
        if ($locked->versions()->whereNotNull('name')->count() < WhiteboardVersion::MaxNamed) {
            return;
        }

        throw ValidationException::withMessages(['name' => __('This board already has 100 saved versions.')]);
    }
}
