<?php

namespace App\Http\Controllers\Admin;

use App\Actions\Admin\TestOidcDiscovery;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\SsoConnectionTestStoreRequest;
use Illuminate\Http\RedirectResponse;
use Inertia\Inertia;

class SsoConnectionTestsController extends Controller
{
    public function store(SsoConnectionTestStoreRequest $request, TestOidcDiscovery $testOidcDiscovery): RedirectResponse
    {
        Inertia::flash('ssoTest', $testOidcDiscovery->handle($request->user(), $request->provider()));

        return to_route('admin.signIn.edit');
    }
}
