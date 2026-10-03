<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Support\InstanceVersion;
use Inertia\Inertia;
use Inertia\Response;

class LicencesController extends Controller
{
    /**
     * The licence belongs to the project, not to a deployment: it is read from the project's
     * configuration, never from the environment.
     */
    public function show(InstanceVersion $instanceVersion): Response
    {
        return Inertia::render('admin/licence', [
            'licence' => (string) config('skrum.licence'),
            'licenceUrl' => (string) config('skrum.licence_url'),
            'repositoryUrl' => (string) config('skrum.repository_url'),
            'accountsInUse' => User::query()->whereNull('deactivated_at')->count(),
            'version' => $instanceVersion->current(),
        ]);
    }
}
