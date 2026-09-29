<?php

use App\Actions\Auth\SignupGate;
use App\Http\Controllers\CurrentWorkspaceController;
use App\Http\Controllers\InvitationAcceptancesController;
use App\Http\Controllers\InvitationLinksController;
use App\Http\Controllers\LocalesController;
use App\Http\Controllers\SsoCallbacksController;
use App\Http\Controllers\SsoRedirectsController;
use App\Http\Controllers\TeamMembersController;
use App\Http\Controllers\TeamsController;
use App\Http\Controllers\WorkspaceInvitationsController;
use App\Http\Controllers\WorkspaceMembersController;
use App\Http\Controllers\WorkspacesController;
use App\Http\Middleware\RememberCurrentWorkspace;
use Illuminate\Support\Facades\Route;
use Inertia\Inertia;

Route::get('/', fn () => Inertia::render('welcome', [
    'canRegister' => app(SignupGate::class)->canShowRegistration(),
]))->name('home');

Route::get('invitations/{token}', [InvitationLinksController::class, 'show'])->name('invitations.show');

Route::post('invitations/{token}/acceptance', [InvitationAcceptancesController::class, 'store'])
    ->middleware('auth')
    ->name('invitations.acceptance.store');

Route::middleware('guest')->group(function () {
    Route::get('auth/{provider}/redirect', [SsoRedirectsController::class, 'show'])->name('sso.redirect');
    Route::get('auth/{provider}/callback', [SsoCallbacksController::class, 'show'])->name('sso.callback');
});

Route::put('locale', [LocalesController::class, 'update'])->name('locale.update');

Route::middleware(['auth', 'verified'])->group(function () {
    Route::get('dashboard', [CurrentWorkspaceController::class, 'show'])->name('dashboard');
    Route::get('workspaces/create', [WorkspacesController::class, 'create'])->name('workspaces.create');
    Route::post('workspaces', [WorkspacesController::class, 'store'])->name('workspaces.store');

    Route::prefix('w/{workspace}')
        ->middleware(['can:view,workspace', RememberCurrentWorkspace::class])
        ->scopeBindings()
        ->group(function () {
            Route::get('/', [WorkspacesController::class, 'show'])->name('workspaces.show');
            Route::delete('/', [WorkspacesController::class, 'destroy'])->name('workspaces.destroy');

            Route::post('teams', [TeamsController::class, 'store'])->name('teams.store');
            Route::get('teams/{team}', [TeamsController::class, 'show'])->name('teams.show');
            Route::patch('teams/{team}', [TeamsController::class, 'update'])->name('teams.update');
            Route::delete('teams/{team}', [TeamsController::class, 'destroy'])->name('teams.destroy');
            Route::post('teams/{team}/members', [TeamMembersController::class, 'store'])->name('teams.members.store');
            Route::delete('teams/{team}/members/{member}', [TeamMembersController::class, 'destroy'])->name('teams.members.destroy')->whereUuid('member');

            Route::get('members', [WorkspaceMembersController::class, 'index'])->name('workspaces.members.index');
            Route::patch('members/{member}', [WorkspaceMembersController::class, 'update'])->name('workspaces.members.update')->whereUuid('member');
            Route::delete('members/{member}', [WorkspaceMembersController::class, 'destroy'])->name('workspaces.members.destroy')->whereUuid('member');
            Route::post('invitations', [WorkspaceInvitationsController::class, 'store'])->name('workspaces.invitations.store')->middleware('throttle:20,1');
            Route::delete('invitations/{invitation}', [WorkspaceInvitationsController::class, 'destroy'])->name('workspaces.invitations.destroy');
        });
});

require __DIR__.'/settings.php';
