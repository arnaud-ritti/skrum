<?php

namespace App\Http\Controllers\Whiteboards;

use App\Actions\Whiteboards\OrderWhiteboardElements;
use App\Actions\Whiteboards\WhiteboardGuard;
use App\Actions\Whiteboards\WriteWhiteboardElements;
use App\Http\Controllers\Controller;
use App\Models\Whiteboard;
use App\Models\WhiteboardElement;
use App\Models\WhiteboardMember;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class WhiteboardElementsController extends Controller
{
    public function index(
        Request $request,
        Whiteboard $board,
        OrderWhiteboardElements $orderWhiteboardElements,
    ): JsonResponse {
        $validated = $request->validate([
            'since' => ['required', 'integer', 'min:0'],
        ]);

        $since = (int) $validated['since'];

        abort_if($since < $board->purged_seq, 409, __('This board changed too much. Reloading it.'));

        return response()->json([
            'seq' => $board->seq,
            'elements' => $orderWhiteboardElements
                ->handle($board->elements()->where('seq', '>', $since)->orderBy('seq')->get())
                ->map(fn (WhiteboardElement $element): array => $element->data)
                ->all(),
        ]);
    }

    public function update(Request $request, Whiteboard $board, WriteWhiteboardElements $writeWhiteboardElements): JsonResponse
    {
        $member = WhiteboardMember::current($request);

        WhiteboardGuard::notLocked($board, $member);

        $payload = json_decode($request->getContent(), true);

        $validated = Validator::make(is_array($payload) ? $payload : [], [
            'elements' => ['required', 'array', 'list', 'min:1', 'max:'.WriteWhiteboardElements::MaxBatch],
        ])->validate();

        return response()->json($writeWhiteboardElements->handle($board, $member, $validated['elements']));
    }
}
