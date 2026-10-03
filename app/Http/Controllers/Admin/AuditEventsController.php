<?php

namespace App\Http\Controllers\Admin;

use App\Actions\Admin\PresentAuditEvents;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\AuditEventsIndexRequest;
use App\Models\AuditEvent;
use Inertia\Inertia;
use Inertia\Response;

class AuditEventsController extends Controller
{
    public function index(AuditEventsIndexRequest $request, PresentAuditEvents $presentAuditEvents): Response
    {
        $group = $request->group();
        $actor = $request->actor();

        return Inertia::render('admin/audit-log', [
            'events' => $presentAuditEvents->handle($group, $actor),
            'filters' => [
                'group' => $group,
                'actor' => $actor,
            ],
            'retentionDays' => AuditEvent::Retention,
        ]);
    }
}
