<?php

namespace App\Http\Controllers\Retros;

use App\Actions\Retros\BuildBoardSnapshot;
use App\Actions\Retros\RetroGuard;
use App\Events\Retros\RetroDeleted;
use App\Http\Controllers\Controller;
use App\Models\Participant;
use App\Models\Retro;
use Illuminate\Http\Request;
use Illuminate\Http\Response as HttpResponse;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

class RetrosController extends Controller
{
    public function show(Request $request, Retro $retro, BuildBoardSnapshot $buildBoardSnapshot): Response
    {
        return Inertia::render('retros/show', [
            'snapshot' => $buildBoardSnapshot->handle($retro, Participant::current($request)),
        ]);
    }

    public function destroy(Request $request, Retro $retro): HttpResponse
    {
        $participant = Participant::current($request);

        RetroGuard::facilitator($retro, $participant);

        DB::transaction(function () use ($retro, $participant): void {
            $locked = Retro::query()->whereKey($retro->id)->lockForUpdate()->firstOrFail();

            RetroGuard::facilitator($locked, $participant);

            $retroId = $locked->id;

            $locked->delete();

            (new RetroDeleted($retroId))->sendToOthers();
        });

        return response()->noContent();
    }
}
