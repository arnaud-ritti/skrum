<?php

namespace App\Http\Controllers\Retros;

use App\Actions\Retros\BuildBoardSnapshot;
use App\Http\Controllers\Controller;
use App\Models\Participant;
use App\Models\Retro;
use Illuminate\Http\Request;
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
}
