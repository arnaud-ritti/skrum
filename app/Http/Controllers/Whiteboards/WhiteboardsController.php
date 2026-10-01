<?php

namespace App\Http\Controllers\Whiteboards;

use App\Actions\Whiteboards\BuildWhiteboardSnapshot;
use App\Actions\Whiteboards\WhiteboardGuard;
use App\Events\Whiteboards\WhiteboardDeleted;
use App\Http\Controllers\Controller;
use App\Models\Whiteboard;
use App\Models\WhiteboardMember;
use Illuminate\Http\Request;
use Illuminate\Http\Response as HttpResponse;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

class WhiteboardsController extends Controller
{
    public function show(Request $request, Whiteboard $board, BuildWhiteboardSnapshot $buildWhiteboardSnapshot): Response
    {
        return Inertia::render('whiteboards/show', [
            'snapshot' => $buildWhiteboardSnapshot->handle($board, WhiteboardMember::current($request)),
        ]);
    }

    public function destroy(Request $request, Whiteboard $board): HttpResponse
    {
        $member = WhiteboardMember::current($request);

        WhiteboardGuard::canDelete($board, $member);

        DB::transaction(function () use ($board, $member): void {
            $locked = Whiteboard::query()->whereKey($board->id)->lockForUpdate()->firstOrFail();

            WhiteboardGuard::canDelete($locked, $member);

            $boardId = $locked->id;

            $locked->delete();

            (new WhiteboardDeleted($boardId))->sendToOthers();
        });

        return response()->noContent();
    }
}
