<?php

namespace App\Http\Controllers\Admin;

use App\Actions\Admin\SendInstanceTestMail;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\MailTestStoreRequest;
use Illuminate\Http\RedirectResponse;
use Inertia\Inertia;

class MailTestsController extends Controller
{
    public function store(MailTestStoreRequest $request, SendInstanceTestMail $sendInstanceTestMail): RedirectResponse
    {
        Inertia::flash('mailTest', $sendInstanceTestMail->handle($request->user(), $request->recipient()));

        return to_route('admin.mail.show');
    }
}
