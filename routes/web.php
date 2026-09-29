<?php

use App\Actions\Auth\SignupGate;
use App\Http\Controllers\AvatarsController;
use App\Http\Controllers\BroadcastAuthorizationsController;
use App\Http\Controllers\CurrentWorkspaceController;
use App\Http\Controllers\InvitationAcceptancesController;
use App\Http\Controllers\InvitationLinksController;
use App\Http\Controllers\LocalesController;
use App\Http\Controllers\RetroJoinsController;
use App\Http\Controllers\Retros\ActionItemsController;
use App\Http\Controllers\Retros\CardCommentsController;
use App\Http\Controllers\Retros\CardGroupsController;
use App\Http\Controllers\Retros\CardPositionsController;
use App\Http\Controllers\Retros\CardReactionsController;
use App\Http\Controllers\Retros\CardsController;
use App\Http\Controllers\Retros\CardVotesController;
use App\Http\Controllers\Retros\ColumnOrdersController;
use App\Http\Controllers\Retros\ColumnsController;
use App\Http\Controllers\Retros\RetroFacilitatorsController;
use App\Http\Controllers\Retros\RetroGuestTokensController;
use App\Http\Controllers\Retros\RetroHighlightsController;
use App\Http\Controllers\Retros\RetroPhasesController;
use App\Http\Controllers\Retros\RetrosController;
use App\Http\Controllers\Retros\RetroSettingsController;
use App\Http\Controllers\Retros\RetroSnapshotsController;
use App\Http\Controllers\Retros\RetroTimersController;
use App\Http\Controllers\SsoCallbacksController;
use App\Http\Controllers\SsoRedirectsController;
use App\Http\Controllers\TeamMembersController;
use App\Http\Controllers\TeamRetrosController;
use App\Http\Controllers\TeamsController;
use App\Http\Controllers\WorkspaceInvitationsController;
use App\Http\Controllers\WorkspaceMembersController;
use App\Http\Controllers\WorkspacesController;
use App\Http\Middleware\RememberCurrentWorkspace;
use App\Http\Middleware\ResolveRetroParticipant;
use Illuminate\Support\Facades\Route;
use Inertia\Inertia;

Route::get('/', fn () => Inertia::render('welcome', [
    'canRegister' => app(SignupGate::class)->canShowRegistration(),
]))->name('home');

Route::get('invitations/{token}', [InvitationLinksController::class, 'show'])->name('invitations.show');

Route::get('avatars/{seed}.svg', [AvatarsController::class, 'show'])->where('seed', '[a-f0-9]{32}')->name('avatars.show');

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
            Route::post('teams/{team}/retros', [TeamRetrosController::class, 'store'])->name('teams.retros.store');
            Route::post('teams/{team}/members', [TeamMembersController::class, 'store'])->name('teams.members.store');
            Route::delete('teams/{team}/members/{member}', [TeamMembersController::class, 'destroy'])->name('teams.members.destroy')->whereUuid('member');

            Route::get('members', [WorkspaceMembersController::class, 'index'])->name('workspaces.members.index');
            Route::patch('members/{member}', [WorkspaceMembersController::class, 'update'])->name('workspaces.members.update')->whereUuid('member');
            Route::delete('members/{member}', [WorkspaceMembersController::class, 'destroy'])->name('workspaces.members.destroy')->whereUuid('member');
            Route::post('invitations', [WorkspaceInvitationsController::class, 'store'])->name('workspaces.invitations.store')->middleware('throttle:20,1');
            Route::delete('invitations/{invitation}', [WorkspaceInvitationsController::class, 'destroy'])->name('workspaces.invitations.destroy');
        });
});

Route::get('join/{guestToken}', [RetroJoinsController::class, 'show'])->name('retros.join.show');
Route::post('join/{guestToken}', [RetroJoinsController::class, 'store'])->name('retros.join.store')->middleware('throttle:10,1');

Route::prefix('retros/{retro}')
    ->whereUuid('retro')
    ->middleware(ResolveRetroParticipant::class)
    ->scopeBindings()
    ->group(function () {
        Route::get('/', [RetrosController::class, 'show'])->name('retros.show');
        Route::delete('/', [RetrosController::class, 'destroy'])->name('retros.destroy');
        Route::put('phase', [RetroPhasesController::class, 'update'])->name('retros.phase.update');
        Route::put('timer', [RetroTimersController::class, 'update'])->name('retros.timer.update');
        Route::put('highlight', [RetroHighlightsController::class, 'update'])->name('retros.highlight.update');
        Route::patch('settings', [RetroSettingsController::class, 'update'])->name('retros.settings.update');
        Route::post('guest-token', [RetroGuestTokensController::class, 'store'])->name('retros.guest-token.store');
        Route::put('facilitator', [RetroFacilitatorsController::class, 'update'])->name('retros.facilitator.update');
        Route::get('snapshot', [RetroSnapshotsController::class, 'show'])->name('retros.snapshot.show');
        Route::post('columns', [ColumnsController::class, 'store'])->name('retros.columns.store');
        Route::patch('columns/{column}', [ColumnsController::class, 'update'])->name('retros.columns.update')->whereUuid('column');
        Route::delete('columns/{column}', [ColumnsController::class, 'destroy'])->name('retros.columns.destroy')->whereUuid('column');
        Route::put('column-order', [ColumnOrdersController::class, 'update'])->name('retros.columns.order.update');
        Route::post('cards', [CardsController::class, 'store'])->name('retros.cards.store');
        Route::patch('cards/{card}', [CardsController::class, 'update'])->name('retros.cards.update')->whereUuid('card');
        Route::delete('cards/{card}', [CardsController::class, 'destroy'])->name('retros.cards.destroy')->whereUuid('card');
        Route::put('cards/{card}/position', [CardPositionsController::class, 'update'])->name('retros.cards.position.update')->whereUuid('card');
        Route::put('cards/{card}/group', [CardGroupsController::class, 'update'])->name('retros.cards.group.update')->whereUuid('card');
        Route::delete('cards/{card}/group', [CardGroupsController::class, 'destroy'])->name('retros.cards.group.destroy')->whereUuid('card');
        Route::post('cards/{card}/votes', [CardVotesController::class, 'store'])->name('retros.cards.votes.store')->whereUuid('card');
        Route::delete('cards/{card}/votes', [CardVotesController::class, 'destroy'])->name('retros.cards.votes.destroy')->whereUuid('card');
        Route::put('cards/{card}/reactions', [CardReactionsController::class, 'update'])->name('retros.cards.reactions.update')->whereUuid('card');
        Route::delete('cards/{card}/reactions', [CardReactionsController::class, 'destroy'])->name('retros.cards.reactions.destroy')->whereUuid('card');
        Route::post('cards/{card}/comments', [CardCommentsController::class, 'store'])->name('retros.cards.comments.store')->whereUuid('card');
        Route::patch('comments/{comment}', [CardCommentsController::class, 'update'])->name('retros.comments.update')->whereUuid('comment');
        Route::delete('comments/{comment}', [CardCommentsController::class, 'destroy'])->name('retros.comments.destroy')->whereUuid('comment');
        Route::post('action-items', [ActionItemsController::class, 'store'])->name('retros.action-items.store');
        Route::patch('action-items/{actionItem}', [ActionItemsController::class, 'update'])->name('retros.action-items.update')->whereUuid('actionItem');
        Route::delete('action-items/{actionItem}', [ActionItemsController::class, 'destroy'])->name('retros.action-items.destroy')->whereUuid('actionItem');
    });

Route::post('broadcasting/auth', [BroadcastAuthorizationsController::class, 'store'])->name('broadcasting.auth');

require __DIR__.'/settings.php';
