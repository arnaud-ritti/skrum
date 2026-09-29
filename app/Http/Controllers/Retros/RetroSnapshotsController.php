<?php

namespace App\Http\Controllers\Retros;

use App\Actions\Retros\BuildBoardSnapshot;
use App\Http\Controllers\Controller;
use App\Models\Participant;
use App\Models\Retro;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class RetroSnapshotsController extends Controller
{
    public function show(Request $request, Retro $retro, BuildBoardSnapshot $buildBoardSnapshot): JsonResponse
    {
        return response()->json($buildBoardSnapshot->handle($retro, Participant::current($request)));
    }
}
