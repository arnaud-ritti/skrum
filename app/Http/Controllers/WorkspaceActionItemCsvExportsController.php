<?php

namespace App\Http\Controllers;

use App\Actions\ActionItems\ActionItemFilters;
use App\Actions\ActionItems\ExportActionItemsCsv;
use App\Models\Workspace;
use App\Support\CsvDownload;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\StreamedResponse;

class WorkspaceActionItemCsvExportsController extends Controller
{
    public function show(Request $request, Workspace $workspace, ExportActionItemsCsv $exportActionItemsCsv): StreamedResponse
    {
        $user = $request->user();
        $filters = ActionItemFilters::fromRequest($request, $workspace->teamsVisibleTo($user));

        return CsvDownload::stream($exportActionItemsCsv->rows($user, $workspace, $filters), $exportActionItemsCsv->fileName($workspace));
    }
}
