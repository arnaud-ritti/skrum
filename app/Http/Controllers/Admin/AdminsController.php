<?php

namespace App\Http\Controllers\Admin;

use App\Actions\Admin\RevokeInstanceAdmin;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\AdminStoreRequest;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class AdminsController extends Controller
{
    public function index(Request $request): Response
    {
        $admins = User::query()
            ->where('is_instance_admin', true)
            ->orderBy('name')
            ->orderBy('id')
            ->get();

        $canRevoke = $admins->count() > 1;

        return Inertia::render('admin/admins', [
            'admins' => $admins
                ->map(fn (User $admin): array => [
                    'id' => $admin->id,
                    'name' => $admin->name,
                    'email' => $admin->email,
                    'avatarUrl' => $admin->avatarUrl(),
                    'isSelf' => $admin->is($request->user()),
                    'canRevoke' => $canRevoke,
                ])
                ->all(),
        ]);
    }

    public function store(AdminStoreRequest $request): RedirectResponse
    {
        User::query()->whereKey($request->validated('user_id'))->update(['is_instance_admin' => true]);

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Admin added.')]);

        return to_route('admin.admins.index');
    }

    public function destroy(Request $request, User $user, RevokeInstanceAdmin $revokeInstanceAdmin): RedirectResponse
    {
        if (! $revokeInstanceAdmin->handle($user)) {
            throw ValidationException::withMessages(['user' => __('An instance needs at least one admin.')]);
        }

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Admin removed.')]);

        if ($user->is($request->user())) {
            return to_route('dashboard');
        }

        return to_route('admin.admins.index');
    }
}
