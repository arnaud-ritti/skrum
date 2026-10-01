<?php

namespace App\Http\Controllers\Whiteboards;

use App\Actions\Whiteboards\SetWhiteboardPrivateWriting;
use App\Actions\Whiteboards\WhiteboardGuard;
use App\Events\Whiteboards\WhiteboardChanged;
use App\Http\Controllers\Controller;
use App\Models\Whiteboard;
use App\Models\WhiteboardMember;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;

class WhiteboardSettingsController extends Controller
{
    public function update(Request $request, Whiteboard $board, SetWhiteboardPrivateWriting $setWhiteboardPrivateWriting): Response
    {
        $member = WhiteboardMember::current($request);

        WhiteboardGuard::facilitator($board, $member);

        $validated = $request->validate([
            'title' => ['sometimes', 'required', 'string', 'max:120'],
            'guest_access_enabled' => ['sometimes', 'boolean'],
            'cursors_enabled' => ['sometimes', 'boolean'],
            'reactions_enabled' => ['sometimes', 'boolean'],
            'locked' => ['sometimes', 'boolean'],
            'follow_enabled' => ['sometimes', 'boolean'],
            'private_writing' => ['sometimes', 'boolean'],
        ]);

        $privateWriting = Arr::pull($validated, 'private_writing');

        DB::transaction(function () use ($board, $member, $validated, $privateWriting, $setWhiteboardPrivateWriting): void {
            $locked = Whiteboard::query()->whereKey($board->id)->lockForUpdate()->firstOrFail();

            WhiteboardGuard::facilitator($locked, $member);

            if ($privateWriting !== null) {
                $setWhiteboardPrivateWriting->handle($locked, (bool) $privateWriting);
            }

            $locked->update($validated);

            (new WhiteboardChanged($locked->id))->sendToOthers();
        });

        return response()->noContent();
    }
}
