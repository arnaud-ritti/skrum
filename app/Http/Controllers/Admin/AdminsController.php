<?php

namespace App\Http\Controllers\Admin;

use App\Actions\Admin\RecordAuditEvent;
use App\Actions\Admin\RevokeInstanceAdmin;
use App\Enums\AuditAction;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\AdminStoreRequest;
use App\Models\User;
use App\Support\Alphabetical;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class AdminsController extends Controller
{
    public function index(Request $request): Response
    {
        $admins = Alphabetical::sort(
            User::query()->where('is_instance_admin', true)->orderBy('id')->get(),
            fn (User $admin): string => $admin->name,
        );

        $hasAnotherActiveAdmin = $admins->whereNull('deactivated_at')->count() > 1;

        return Inertia::render('admin/admins', [
            'admins' => $admins
                ->map(fn (User $admin): array => [
                    'id' => $admin->id,
                    'name' => $admin->name,
                    'email' => $admin->email,
                    'avatarUrl' => $admin->avatarUrl(),
                    'isSelf' => $admin->is($request->user()),
                    'canRevoke' => $admin->deactivated_at !== null || $hasAnotherActiveAdmin,
                ])
                ->all(),
        ]);
    }

    public function store(AdminStoreRequest $request, RecordAuditEvent $recordAuditEvent): RedirectResponse
    {
        DB::transaction(function () use ($request, $recordAuditEvent): void {
            $user = User::query()->whereKey($request->validated('user_id'))->lockForUpdate()->firstOrFail();

            if ($user->is_instance_admin) {
                return;
            }

            $user->forceFill(['is_instance_admin' => true])->save();

            $recordAuditEvent->handle(AuditAction::AdminGranted, $request->user(), $user);
        });

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Admin added.')]);

        return to_route('admin.admins.index');
    }

    public function destroy(Request $request, User $user, RevokeInstanceAdmin $revokeInstanceAdmin): RedirectResponse
    {
        if (! $revokeInstanceAdmin->handle($user, $request->user())) {
            throw ValidationException::withMessages(['user' => __('An instance needs at least one admin.')]);
        }

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Admin removed.')]);

        if ($user->is($request->user())) {
            return to_route('dashboard');
        }

        return to_route('admin.admins.index');
    }
}
