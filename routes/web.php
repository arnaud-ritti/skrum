<?php

use App\Actions\Auth\SignupGate;
use App\Http\Controllers\AvatarsController;
use App\Http\Controllers\BroadcastAuthorizationsController;
use App\Http\Controllers\CurrentWorkspaceController;
use App\Http\Controllers\EmojiDataController;
use App\Http\Controllers\GifsController;
use App\Http\Controllers\InvitationAcceptancesController;
use App\Http\Controllers\InvitationLinksController;
use App\Http\Controllers\LocalesController;
use App\Http\Controllers\NotificationsController;
use App\Http\Controllers\Poker\PokerAutoRevealsController;
use App\Http\Controllers\Poker\PokerCurrentTasksController;
use App\Http\Controllers\Poker\PokerFacilitatorsController;
use App\Http\Controllers\Poker\PokerGamesController;
use App\Http\Controllers\Poker\PokerGuestTokensController;
use App\Http\Controllers\Poker\PokerRevealsController;
use App\Http\Controllers\Poker\PokerRoundsController;
use App\Http\Controllers\Poker\PokerSavedDecksController;
use App\Http\Controllers\Poker\PokerSettingsController;
use App\Http\Controllers\Poker\PokerSnapshotsController;
use App\Http\Controllers\Poker\PokerSpectatorsController;
use App\Http\Controllers\Poker\PokerStatusesController;
use App\Http\Controllers\Poker\PokerTaskEstimatesController;
use App\Http\Controllers\Poker\PokerTaskOrdersController;
use App\Http\Controllers\Poker\PokerTasksController;
use App\Http\Controllers\Poker\PokerTimersController;
use App\Http\Controllers\Poker\PokerVotesController;
use App\Http\Controllers\PokerDecksController;
use App\Http\Controllers\PokerJoinsController;
use App\Http\Controllers\ReadAllNotificationsController;
use App\Http\Controllers\RetroJoinsController;
use App\Http\Controllers\Retros\ActionItemCommentsController;
use App\Http\Controllers\Retros\ActionItemsController;
use App\Http\Controllers\Retros\ActionItemSubtasksController;
use App\Http\Controllers\Retros\CardCommentsController;
use App\Http\Controllers\Retros\CardGroupNamesController;
use App\Http\Controllers\Retros\CardGroupsController;
use App\Http\Controllers\Retros\CardPositionsController;
use App\Http\Controllers\Retros\CardReactionsController;
use App\Http\Controllers\Retros\CardsController;
use App\Http\Controllers\Retros\CardVotesController;
use App\Http\Controllers\Retros\ColumnOrdersController;
use App\Http\Controllers\Retros\ColumnsController;
use App\Http\Controllers\Retros\GroupNameSuggestionsController;
use App\Http\Controllers\Retros\HealthCheckAnswersController;
use App\Http\Controllers\Retros\RetroFacilitatorsController;
use App\Http\Controllers\Retros\RetroGifsController;
use App\Http\Controllers\Retros\RetroGuestTokensController;
use App\Http\Controllers\Retros\RetroHighlightsController;
use App\Http\Controllers\Retros\RetroPhasesController;
use App\Http\Controllers\Retros\RetroRotiController;
use App\Http\Controllers\Retros\RetrosController;
use App\Http\Controllers\Retros\RetroSettingsController;
use App\Http\Controllers\Retros\RetroSnapshotsController;
use App\Http\Controllers\Retros\RetroSummariesController;
use App\Http\Controllers\Retros\RetroTimersController;
use App\Http\Controllers\Retros\SuggestedActionPromotionsController;
use App\Http\Controllers\Retros\SuggestedActionsController;
use App\Http\Controllers\Retros\SurveyClosuresController;
use App\Http\Controllers\Retros\SurveyCommentsController;
use App\Http\Controllers\Retros\SurveyDraftsController;
use App\Http\Controllers\Retros\SurveyReactionsController;
use App\Http\Controllers\Retros\SurveyResponsesController;
use App\Http\Controllers\Retros\SurveysController;
use App\Http\Controllers\SsoCallbacksController;
use App\Http\Controllers\SsoRedirectsController;
use App\Http\Controllers\TeamEstimatesController;
use App\Http\Controllers\TeamHealthStatementArchivalsController;
use App\Http\Controllers\TeamHealthStatementOrdersController;
use App\Http\Controllers\TeamHealthStatementsController;
use App\Http\Controllers\TeamMembersController;
use App\Http\Controllers\TeamPokerGamesController;
use App\Http\Controllers\TeamRetrosController;
use App\Http\Controllers\TeamsController;
use App\Http\Controllers\WorkspaceActionItemCommentsController;
use App\Http\Controllers\WorkspaceActionItemsController;
use App\Http\Controllers\WorkspaceActionItemSubtasksController;
use App\Http\Controllers\WorkspaceInvitationsController;
use App\Http\Controllers\WorkspaceMembersController;
use App\Http\Controllers\WorkspacesController;
use App\Http\Controllers\WorkspaceTemplatesController;
use App\Http\Middleware\RememberCurrentWorkspace;
use App\Http\Middleware\ResolvePokerPlayer;
use App\Http\Middleware\ResolveRetroParticipant;
use Illuminate\Support\Facades\Route;
use Inertia\Inertia;

Route::get('/', fn () => Inertia::render('welcome', [
    'canRegister' => app(SignupGate::class)->canShowRegistration(),
]))->name('home');

Route::get('invitations/{token}', [InvitationLinksController::class, 'show'])->name('invitations.show');

Route::get('avatars/{seed}.svg', [AvatarsController::class, 'show'])->where('seed', '[a-f0-9]{32}')->name('avatars.show');
Route::get('emoji-data/{version}/{locale}/{file}', [EmojiDataController::class, 'show'])
    ->where(['version' => '[0-9.]+', 'locale' => '[a-z-]+', 'file' => '[a-z]+\.json'])
    ->middleware('throttle:120,1')
    ->name('emoji-data.show');

Route::get('gifs/{gif}/{size}', [GifsController::class, 'show'])
    ->where(['gif' => '[A-Za-z0-9_-]{1,64}', 'size' => 'preview|full'])
    ->middleware('throttle:240,1')
    ->name('gifs.show');

Route::post('invitations/{token}/acceptance', [InvitationAcceptancesController::class, 'store'])
    ->middleware('auth')
    ->name('invitations.acceptance.store');

Route::middleware('guest')->group(function () {
    Route::get('auth/{provider}/redirect', [SsoRedirectsController::class, 'show'])->name('sso.redirect');
    Route::get('auth/{provider}/callback', [SsoCallbacksController::class, 'show'])->name('sso.callback');
});

Route::put('locale', [LocalesController::class, 'update'])->name('locale.update');

Route::pattern('statement', '[A-Za-z0-9_-]{1,64}');

Route::middleware(['auth', 'verified'])->group(function () {
    Route::get('dashboard', [CurrentWorkspaceController::class, 'show'])->name('dashboard');
    Route::get('workspaces/create', [WorkspacesController::class, 'create'])->name('workspaces.create');
    Route::post('workspaces', [WorkspacesController::class, 'store'])->name('workspaces.store');
    Route::get('notifications', [NotificationsController::class, 'index'])->name('notifications.index');
    Route::post('notifications/read-all', [ReadAllNotificationsController::class, 'store'])->name('notifications.readAll');
    Route::patch('notifications/{notification}', [NotificationsController::class, 'update'])->name('notifications.update')->whereUuid('notification');

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
            Route::post('teams/{team}/poker-games', [TeamPokerGamesController::class, 'store'])->name('teams.pokerGames.store');
            Route::get('teams/{team}/estimates', [TeamEstimatesController::class, 'index'])->name('teams.estimates.index');
            Route::post('teams/{team}/poker-decks', [PokerDecksController::class, 'store'])->name('teams.pokerDecks.store');
            Route::patch('teams/{team}/poker-decks/{pokerDeck}', [PokerDecksController::class, 'update'])->name('teams.pokerDecks.update')->whereUuid('pokerDeck');
            Route::delete('teams/{team}/poker-decks/{pokerDeck}', [PokerDecksController::class, 'destroy'])->name('teams.pokerDecks.destroy')->whereUuid('pokerDeck');
            Route::post('teams/{team}/members', [TeamMembersController::class, 'store'])->name('teams.members.store');
            Route::delete('teams/{team}/members/{member}', [TeamMembersController::class, 'destroy'])->name('teams.members.destroy')->whereUuid('member');

            Route::post('teams/{team}/health-statements', [TeamHealthStatementsController::class, 'store'])->name('teams.healthStatements.store');
            Route::patch('teams/{team}/health-statements/{statement}', [TeamHealthStatementsController::class, 'update'])->name('teams.healthStatements.update');
            Route::put('teams/{team}/health-statement-order', [TeamHealthStatementOrdersController::class, 'update'])->name('teams.healthStatements.order.update');
            Route::put('teams/{team}/health-statements/{statement}/archival', [TeamHealthStatementArchivalsController::class, 'update'])->name('teams.healthStatements.archival.update');
            Route::delete('teams/{team}/health-statements/{statement}/archival', [TeamHealthStatementArchivalsController::class, 'destroy'])->name('teams.healthStatements.archival.destroy');

            Route::get('members', [WorkspaceMembersController::class, 'index'])->name('workspaces.members.index');
            Route::patch('members/{member}', [WorkspaceMembersController::class, 'update'])->name('workspaces.members.update')->whereUuid('member');
            Route::delete('members/{member}', [WorkspaceMembersController::class, 'destroy'])->name('workspaces.members.destroy')->whereUuid('member');
            Route::post('invitations', [WorkspaceInvitationsController::class, 'store'])->name('workspaces.invitations.store')->middleware('throttle:20,1');
            Route::delete('invitations/{invitation}', [WorkspaceInvitationsController::class, 'destroy'])->name('workspaces.invitations.destroy');

            Route::get('templates', [WorkspaceTemplatesController::class, 'index'])->name('workspaces.templates.index');
            Route::post('templates', [WorkspaceTemplatesController::class, 'store'])->name('workspaces.templates.store');
            Route::patch('templates/{template}', [WorkspaceTemplatesController::class, 'update'])->name('workspaces.templates.update')->whereUuid('template');
            Route::delete('templates/{template}', [WorkspaceTemplatesController::class, 'destroy'])->name('workspaces.templates.destroy')->whereUuid('template');

            Route::get('action-items', [WorkspaceActionItemsController::class, 'index'])->name('workspaces.actionItems.index');
            Route::post('action-items', [WorkspaceActionItemsController::class, 'store'])->name('workspaces.actionItems.store');
            Route::patch('action-items/{actionItem}', [WorkspaceActionItemsController::class, 'update'])->name('workspaces.actionItems.update')->whereUuid('actionItem');
            Route::delete('action-items/{actionItem}', [WorkspaceActionItemsController::class, 'destroy'])->name('workspaces.actionItems.destroy')->whereUuid('actionItem');
            Route::get('action-items/{actionItem}/comments', [WorkspaceActionItemCommentsController::class, 'index'])->name('workspaces.actionItemComments.index')->whereUuid('actionItem');
            Route::post('action-items/{actionItem}/comments', [WorkspaceActionItemCommentsController::class, 'store'])->name('workspaces.actionItemComments.store')->whereUuid('actionItem');
            Route::patch('action-item-comments/{actionItemComment}', [WorkspaceActionItemCommentsController::class, 'update'])->name('workspaces.actionItemComments.update')->whereUuid('actionItemComment')->withoutScopedBindings();
            Route::delete('action-item-comments/{actionItemComment}', [WorkspaceActionItemCommentsController::class, 'destroy'])->name('workspaces.actionItemComments.destroy')->whereUuid('actionItemComment')->withoutScopedBindings();
            Route::post('action-items/{actionItem}/subtasks', [WorkspaceActionItemSubtasksController::class, 'store'])->name('workspaces.actionItemSubtasks.store')->whereUuid('actionItem');
            Route::patch('action-item-subtasks/{actionItemSubtask}', [WorkspaceActionItemSubtasksController::class, 'update'])->name('workspaces.actionItemSubtasks.update')->whereUuid('actionItemSubtask')->withoutScopedBindings();
            Route::delete('action-item-subtasks/{actionItemSubtask}', [WorkspaceActionItemSubtasksController::class, 'destroy'])->name('workspaces.actionItemSubtasks.destroy')->whereUuid('actionItemSubtask')->withoutScopedBindings();
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
        Route::put('roti', [RetroRotiController::class, 'update'])->name('retros.roti.update');
        Route::delete('roti', [RetroRotiController::class, 'destroy'])->name('retros.roti.destroy');
        Route::put('health-check/{statement}', [HealthCheckAnswersController::class, 'update'])->name('retros.health-check.update')->where('statement', '[A-Za-z0-9_-]{1,64}');
        Route::delete('health-check/{statement}', [HealthCheckAnswersController::class, 'destroy'])->name('retros.health-check.destroy')->where('statement', '[A-Za-z0-9_-]{1,64}');
        Route::post('columns', [ColumnsController::class, 'store'])->name('retros.columns.store');
        Route::patch('columns/{column}', [ColumnsController::class, 'update'])->name('retros.columns.update')->whereUuid('column');
        Route::delete('columns/{column}', [ColumnsController::class, 'destroy'])->name('retros.columns.destroy')->whereUuid('column');
        Route::put('column-order', [ColumnOrdersController::class, 'update'])->name('retros.columns.order.update');
        Route::post('cards', [CardsController::class, 'store'])->name('retros.cards.store');
        Route::patch('cards/{card}', [CardsController::class, 'update'])->name('retros.cards.update')->whereUuid('card');
        Route::delete('cards/{card}', [CardsController::class, 'destroy'])->name('retros.cards.destroy')->whereUuid('card');
        Route::get('gifs', [RetroGifsController::class, 'index'])->name('retros.gifs.index');
        Route::put('cards/{card}/position', [CardPositionsController::class, 'update'])->name('retros.cards.position.update')->whereUuid('card');
        Route::put('cards/{card}/group', [CardGroupsController::class, 'update'])->name('retros.cards.group.update')->whereUuid('card');
        Route::delete('cards/{card}/group', [CardGroupsController::class, 'destroy'])->name('retros.cards.group.destroy')->whereUuid('card');
        Route::put('cards/{card}/group-name', [CardGroupNamesController::class, 'update'])->name('retros.cards.group-name.update')->whereUuid('card');
        Route::delete('cards/{card}/group-name', [CardGroupNamesController::class, 'destroy'])->name('retros.cards.group-name.destroy')->whereUuid('card');
        Route::post('group-name-suggestions', [GroupNameSuggestionsController::class, 'store'])->name('retros.group-name-suggestions.store');
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
        Route::get('action-items/{actionItem}/comments', [ActionItemCommentsController::class, 'index'])->name('retros.action-items.comments.index')->whereUuid('actionItem');
        Route::post('action-items/{actionItem}/comments', [ActionItemCommentsController::class, 'store'])->name('retros.action-items.comments.store')->whereUuid('actionItem');
        Route::patch('action-item-comments/{actionItemComment}', [ActionItemCommentsController::class, 'update'])->name('retros.action-items.comments.update')->whereUuid('actionItemComment');
        Route::delete('action-item-comments/{actionItemComment}', [ActionItemCommentsController::class, 'destroy'])->name('retros.action-items.comments.destroy')->whereUuid('actionItemComment');
        Route::post('action-items/{actionItem}/subtasks', [ActionItemSubtasksController::class, 'store'])->name('retros.action-items.subtasks.store')->whereUuid('actionItem');
        Route::patch('action-item-subtasks/{actionItemSubtask}', [ActionItemSubtasksController::class, 'update'])->name('retros.action-items.subtasks.update')->whereUuid('actionItemSubtask');
        Route::delete('action-item-subtasks/{actionItemSubtask}', [ActionItemSubtasksController::class, 'destroy'])->name('retros.action-items.subtasks.destroy')->whereUuid('actionItemSubtask');
        Route::post('summary', [RetroSummariesController::class, 'store'])->name('retros.summary.store');
        Route::delete('summary', [RetroSummariesController::class, 'destroy'])->name('retros.summary.destroy');
        Route::post('suggested-actions/{suggestedAction}/promotion', [SuggestedActionPromotionsController::class, 'store'])->name('retros.suggested-actions.promotion.store')->whereUuid('suggestedAction');
        Route::delete('suggested-actions/{suggestedAction}', [SuggestedActionsController::class, 'destroy'])->name('retros.suggested-actions.destroy')->whereUuid('suggestedAction');
        Route::post('survey-drafts', [SurveyDraftsController::class, 'store'])->name('retros.survey-drafts.store');
        Route::post('surveys', [SurveysController::class, 'store'])->name('retros.surveys.store');
        Route::get('surveys/{survey}', [SurveysController::class, 'show'])->name('retros.surveys.show')->whereUuid('survey');
        Route::patch('surveys/{survey}', [SurveysController::class, 'update'])->name('retros.surveys.update')->whereUuid('survey');
        Route::delete('surveys/{survey}', [SurveysController::class, 'destroy'])->name('retros.surveys.destroy')->whereUuid('survey');
        Route::put('surveys/{survey}/closure', [SurveyClosuresController::class, 'update'])->name('retros.surveys.closure.update')->whereUuid('survey');
        Route::delete('surveys/{survey}/closure', [SurveyClosuresController::class, 'destroy'])->name('retros.surveys.closure.destroy')->whereUuid('survey');
        Route::put('surveys/{survey}/response', [SurveyResponsesController::class, 'update'])->name('retros.surveys.response.update')->whereUuid('survey');
        Route::delete('surveys/{survey}/response', [SurveyResponsesController::class, 'destroy'])->name('retros.surveys.response.destroy')->whereUuid('survey');
        Route::put('surveys/{survey}/reactions', [SurveyReactionsController::class, 'update'])->name('retros.surveys.reactions.update')->whereUuid('survey');
        Route::delete('surveys/{survey}/reactions', [SurveyReactionsController::class, 'destroy'])->name('retros.surveys.reactions.destroy')->whereUuid('survey');
        Route::post('surveys/{survey}/comments', [SurveyCommentsController::class, 'store'])->name('retros.surveys.comments.store')->whereUuid('survey');
        Route::patch('survey-comments/{surveyComment}', [SurveyCommentsController::class, 'update'])->name('retros.survey-comments.update')->whereUuid('surveyComment');
        Route::delete('survey-comments/{surveyComment}', [SurveyCommentsController::class, 'destroy'])->name('retros.survey-comments.destroy')->whereUuid('surveyComment');
    });

Route::get('poker/join/{guestToken}', [PokerJoinsController::class, 'show'])->name('poker.join.show');
Route::post('poker/join/{guestToken}', [PokerJoinsController::class, 'store'])->name('poker.join.store')->middleware('throttle:10,1');

Route::prefix('poker/{game}')
    ->whereUuid('game')
    ->middleware(ResolvePokerPlayer::class)
    ->scopeBindings()
    ->group(function () {
        Route::get('/', [PokerGamesController::class, 'show'])->name('poker.show');
        Route::get('snapshot', [PokerSnapshotsController::class, 'show'])->name('poker.snapshot.show');
        Route::post('tasks', [PokerTasksController::class, 'store'])->name('poker.tasks.store');
        Route::patch('tasks/{task}', [PokerTasksController::class, 'update'])->name('poker.tasks.update')->whereUuid('task');
        Route::delete('tasks/{task}', [PokerTasksController::class, 'destroy'])->name('poker.tasks.destroy')->whereUuid('task');
        Route::put('task-order', [PokerTaskOrdersController::class, 'update'])->name('poker.task-order.update');
        Route::put('current-task', [PokerCurrentTasksController::class, 'update'])->name('poker.current-task.update');
        Route::put('rounds/{round}/vote', [PokerVotesController::class, 'update'])->name('poker.rounds.vote.update')->whereUuid('round');
        Route::delete('rounds/{round}/vote', [PokerVotesController::class, 'destroy'])->name('poker.rounds.vote.destroy')->whereUuid('round');
        Route::post('rounds/{round}/reveal', [PokerRevealsController::class, 'store'])->name('poker.rounds.reveal.store')->whereUuid('round');
        Route::post('rounds/{round}/auto-reveal', [PokerAutoRevealsController::class, 'store'])->middleware('throttle:30,1')->name('poker.rounds.auto-reveal.store')->whereUuid('round');
        Route::put('rounds/{round}/timer', [PokerTimersController::class, 'update'])->name('poker.rounds.timer.update')->whereUuid('round');

        Route::post('tasks/{task}/rounds', [PokerRoundsController::class, 'store'])->name('poker.tasks.rounds.store')->whereUuid('task');
        Route::get('tasks/{task}/rounds', [PokerRoundsController::class, 'index'])->name('poker.tasks.rounds.index')->whereUuid('task');
        Route::put('tasks/{task}/estimate', [PokerTaskEstimatesController::class, 'update'])->name('poker.tasks.estimate.update')->whereUuid('task');
        Route::patch('settings', [PokerSettingsController::class, 'update'])->name('poker.settings.update');
        Route::get('saved-decks', [PokerSavedDecksController::class, 'index'])->name('poker.saved-decks.index');
        Route::put('status', [PokerStatusesController::class, 'update'])->name('poker.status.update');
        Route::post('guest-token', [PokerGuestTokensController::class, 'store'])->name('poker.guest-token.store');
        Route::put('facilitator', [PokerFacilitatorsController::class, 'update'])->name('poker.facilitator.update');
        Route::put('players/{player}/spectator', [PokerSpectatorsController::class, 'update'])->name('poker.players.spectator.update')->whereUuid('player');
        Route::delete('/', [PokerGamesController::class, 'destroy'])->name('poker.destroy');
    });

Route::post('broadcasting/auth', [BroadcastAuthorizationsController::class, 'store'])->name('broadcasting.auth');

require __DIR__.'/settings.php';
