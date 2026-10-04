<?php

namespace App\Http\Controllers\Whiteboards;

use App\Actions\Whiteboards\SanitizeWhiteboardElement;
use App\Actions\Whiteboards\WhiteboardGuard;
use App\Http\Controllers\Controller;
use App\Models\Whiteboard;
use App\Models\WhiteboardFile;
use App\Models\WhiteboardMember;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpFoundation\StreamedResponse;
use Symfony\Component\Mime\MimeTypes;

class WhiteboardFilesController extends Controller
{
    private const array MimeTypes = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];

    public function store(Request $request, Whiteboard $board): JsonResponse
    {
        $member = WhiteboardMember::current($request);

        WhiteboardGuard::notLocked($board, $member);

        $validated = $request->validate([
            'file_id' => ['required', 'string', 'regex:'.SanitizeWhiteboardElement::FileIdPattern],
            'file' => ['required', 'file', 'max:'.Whiteboard::MaxFileKilobytes],
        ]);

        /** @var UploadedFile $upload */
        $upload = $validated['file'];
        $mimeType = (string) MimeTypes::getDefault()->guessMimeType($upload->getRealPath());

        if (! in_array($mimeType, self::MimeTypes, true)) {
            throw ValidationException::withMessages(['file' => __('Only PNG, JPEG, WebP and GIF images can be added.')]);
        }

        $file = DB::transaction(function () use ($board, $member, $validated, $upload, $mimeType): WhiteboardFile {
            $locked = Whiteboard::query()->whereKey($board->id)->lockForUpdate()->firstOrFail();

            WhiteboardGuard::notLocked($locked, $member);

            $existing = $locked->files()->where('file_id', $validated['file_id'])->first();

            if ($existing !== null) {
                return $existing;
            }

            if ((int) $locked->files()->sum('size') + $upload->getSize() > Whiteboard::MaxStorageBytes) {
                throw ValidationException::withMessages(['file' => __('This board has reached its image storage limit.')]);
            }

            $path = Storage::putFileAs($locked->storageDirectory(), $upload, $validated['file_id']);

            abort_if($path === false, 500);

            return $locked->files()->create([
                'file_id' => $validated['file_id'],
                'path' => $path,
                'mime_type' => $mimeType,
                'size' => $upload->getSize(),
                'uploaded_by_member_id' => $member->id,
            ]);
        });

        return response()->json($this->present($board, $file), $file->wasRecentlyCreated ? 201 : 200);
    }

    public function show(Whiteboard $board, string $fileId): StreamedResponse
    {
        $file = $board->files()->where('file_id', $fileId)->firstOrFail();

        return Storage::response($file->path, null, [
            'Content-Type' => $file->mime_type,
            'Content-Disposition' => 'inline',
            'X-Content-Type-Options' => 'nosniff',
            'Cache-Control' => 'private, max-age=31536000, immutable',
        ]);
    }

    /**
     * @return array{id: string, url: string, mimeType: string}
     */
    private function present(Whiteboard $board, WhiteboardFile $file): array
    {
        return [
            'id' => $file->file_id,
            'url' => route('whiteboards.files.show', [$board, $file->file_id], absolute: false),
            'mimeType' => $file->mime_type,
        ];
    }
}
