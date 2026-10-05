<?php

use App\Http\Controllers\AboutPagesController;
use App\Http\Controllers\AvatarPhotosController;
use App\Http\Controllers\AvatarsController;
use App\Http\Controllers\BrandAssetsController;
use App\Http\Controllers\BroadcastAuthorizationsController;
use App\Http\Controllers\CurrentWorkspaceController;
use App\Http\Controllers\DesignSystemPagesController;
use App\Http\Controllers\EmailChallengeCodesController;
use App\Http\Controllers\EmailCodeChallengesController;
use App\Http\Controllers\EmojiDataController;
use App\Http\Controllers\GameJoinsController;
use App\Http\Controllers\Games\GameAnswersController;
use App\Http\Controllers\Games\GameChoicesController;
use App\Http\Controllers\Games\GameClosuresController;
use App\Http\Controllers\Games\GameDrawingOpsController;
use App\Http\Controllers\Games\GameDrawingsController;
use App\Http\Controllers\Games\GameGifsController;
use App\Http\Controllers\Games\GameGuessesController;
use App\Http\Controllers\Games\GameGuestTokensController;
use App\Http\Controllers\Games\GameHostsController;
use App\Http\Controllers\Games\GameLastDrawingOpsController;
use App\Http\Controllers\Games\GameLettersController;
use App\Http\Controllers\Games\GameQuestionsController;
use App\Http\Controllers\Games\GameRevealsController;
use App\Http\Controllers\Games\GameRoomsController;
use App\Http\Controllers\Games\GameRoundCluesController;
use App\Http\Controllers\Games\GameRoundHintsController;
use App\Http\Controllers\Games\GameRoundPassesController;
use App\Http\Controllers\Games\GameRoundsController;
use App\Http\Controllers\Games\GameRoundSecretsController;
use App\Http\Controllers\Games\GameScoresController;
use App\Http\Controllers\Games\GameSharesController;
use App\Http\Controllers\Games\GameSnapshotsController;
use App\Http\Controllers\Games\GameStatementsController;
use App\Http\Controllers\Games\GameSwitchesController;
use App\Http\Controllers\Games\GameTextAnswersController;
use App\Http\Controllers\Games\GameTimerExtensionsController;
use App\Http\Controllers\Games\GameTimersController;
use App\Http\Controllers\Games\GameTurnsController;
use App\Http\Controllers\Games\GameVotesController;
use App\Http\Controllers\Games\GameWordChangesController;
use App\Http\Controllers\Games\GameWordGuessesController;
use App\Http\Controllers\GifsController;
use App\Http\Controllers\Integrations\IntegrationAccountsController;
use App\Http\Controllers\Integrations\IntegrationAuthorizationsController;
use App\Http\Controllers\Integrations\IntegrationCallbacksController;
use App\Http\Controllers\Integrations\IntegrationPrioritiesController;
use App\Http\Controllers\Integrations\IntegrationStatusesController;
use App\Http\Controllers\Integrations\IntegrationTargetsController;
use App\Http\Controllers\Integrations\IntegrationTestsController;
use App\Http\Controllers\Integrations\IntegrationUrlsController;
use App\Http\Controllers\Integrations\IntegrationUserMappingsController;
use App\Http\Controllers\Integrations\IntegrationUserMatchesController;
use App\Http\Controllers\Integrations\JiraDataCenterTokensController;
use App\Http\Controllers\Integrations\JiraFieldDetectionsController;
use App\Http\Controllers\Integrations\PokerEstimateConflictsController;
use App\Http\Controllers\Integrations\PokerImportContainersController;
use App\Http\Controllers\Integrations\PokerImportIterationsController;
use App\Http\Controllers\Integrations\PokerImportPreviewsController;
use App\Http\Controllers\Integrations\PokerImportRefreshesController;
use App\Http\Controllers\Integrations\PokerImportsController;
use App\Http\Controllers\Integrations\PokerSharesController;
use App\Http\Controllers\Integrations\PokerTaskSyncsController;
use App\Http\Controllers\Integrations\RetroActionItemExportPreviewsController;
use App\Http\Controllers\Integrations\RetroActionItemExportsController;
use App\Http\Controllers\Integrations\RetroActionItemLinkSyncsController;
use App\Http\Controllers\Integrations\RetroResultsEmailsController;
use App\Http\Controllers\Integrations\RetroSharesController;
use App\Http\Controllers\Integrations\TeamIntegrationsController;
use App\Http\Controllers\Integrations\TeamPokerImportContainersController;
use App\Http\Controllers\Integrations\TeamPokerImportIterationsController;
use App\Http\Controllers\Integrations\TeamPokerImportPreviewsController;
use App\Http\Controllers\Integrations\TelegramConnectCodesController;
use App\Http\Controllers\Integrations\TrackerWebhooksController;
use App\Http\Controllers\Integrations\WebhookDeliveriesController;
use App\Http\Controllers\Integrations\WebhookRedeliveriesController;
use App\Http\Controllers\Integrations\WebhookSecretsController;
use App\Http\Controllers\Integrations\WorkspaceActionItemExportPreviewsController;
use App\Http\Controllers\Integrations\WorkspaceActionItemExportsController;
use App\Http\Controllers\Integrations\WorkspaceActionItemLinkSyncsController;
use App\Http\Controllers\InvitationAcceptancesController;
use App\Http\Controllers\InvitationAccountsController;
use App\Http\Controllers\InvitationDeclinesController;
use App\Http\Controllers\InvitationLinksController;
use App\Http\Controllers\InviteLinkMembershipsController;
use App\Http\Controllers\InviteLinksController;
use App\Http\Controllers\JoinCodesController;
use App\Http\Controllers\LocalesController;
use App\Http\Controllers\MagicLinksController;
use App\Http\Controllers\MagicLinkSessionsController;
use App\Http\Controllers\MailPreviewsController;
use App\Http\Controllers\NotificationsController;
use App\Http\Controllers\OnboardingCompletionsController;
use App\Http\Controllers\OnboardingInvitationsController;
use App\Http\Controllers\OnboardingsController;
use App\Http\Controllers\OnboardingStepsController;
use App\Http\Controllers\OnboardingTeamsController;
use App\Http\Controllers\OnboardingWorkspacesController;
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
use App\Http\Controllers\Poker\PokerTimerExtensionsController;
use App\Http\Controllers\Poker\PokerTimersController;
use App\Http\Controllers\Poker\PokerVotesController;
use App\Http\Controllers\PokerDeckDuplicatesController;
use App\Http\Controllers\PokerDecksController;
use App\Http\Controllers\PokerJoinsController;
use App\Http\Controllers\ReadAllNotificationsController;
use App\Http\Controllers\RecapUnsubscribesController;
use App\Http\Controllers\RecentSessionsController;
use App\Http\Controllers\ReminderUnsubscribesController;
use App\Http\Controllers\RetroJoinsController;
use App\Http\Controllers\Retros\ActionItemCommentsController;
use App\Http\Controllers\Retros\ActionItemsController;
use App\Http\Controllers\Retros\ActionItemSubtasksController;
use App\Http\Controllers\Retros\CardCommentsController;
use App\Http\Controllers\Retros\CardDiscussionsController;
use App\Http\Controllers\Retros\CardGroupNamesController;
use App\Http\Controllers\Retros\CardGroupsController;
use App\Http\Controllers\Retros\CardPositionsController;
use App\Http\Controllers\Retros\CardReactionsController;
use App\Http\Controllers\Retros\CardsController;
use App\Http\Controllers\Retros\CardVotesController;
use App\Http\Controllers\Retros\ColumnOrdersController;
use App\Http\Controllers\Retros\ColumnsController;
use App\Http\Controllers\Retros\GroupNameSuggestionsController;
use App\Http\Controllers\Retros\RetroFacilitatorsController;
use App\Http\Controllers\Retros\RetroGifsController;
use App\Http\Controllers\Retros\RetroGuestTokensController;
use App\Http\Controllers\Retros\RetroHealthCheckClosuresController;
use App\Http\Controllers\Retros\RetroHealthChecksController;
use App\Http\Controllers\Retros\RetroHealthCheckSubmissionsController;
use App\Http\Controllers\Retros\RetroHighlightsController;
use App\Http\Controllers\Retros\RetroPhasesController;
use App\Http\Controllers\Retros\RetroRotiController;
use App\Http\Controllers\Retros\RetroRotiNudgesController;
use App\Http\Controllers\Retros\RetroRotiRevealsController;
use App\Http\Controllers\Retros\RetrosController;
use App\Http\Controllers\Retros\RetroSettingsController;
use App\Http\Controllers\Retros\RetroSnapshotsController;
use App\Http\Controllers\Retros\RetroSummariesController;
use App\Http\Controllers\Retros\RetroTimerExtensionsController;
use App\Http\Controllers\Retros\RetroTimerPausesController;
use App\Http\Controllers\Retros\RetroTimersController;
use App\Http\Controllers\Retros\RetroWritersController;
use App\Http\Controllers\Retros\SuggestedActionPromotionsController;
use App\Http\Controllers\Retros\SuggestedActionsController;
use App\Http\Controllers\Retros\SurveyClosuresController;
use App\Http\Controllers\Retros\SurveyCommentsController;
use App\Http\Controllers\Retros\SurveyDraftsController;
use App\Http\Controllers\Retros\SurveyReactionsController;
use App\Http\Controllers\Retros\SurveyResponsesController;
use App\Http\Controllers\Retros\SurveysController;
use App\Http\Controllers\Retros\TopicNotesController;
use App\Http\Controllers\Retros\VotingCompletionsController;
use App\Http\Controllers\SearchResultsController;
use App\Http\Controllers\SsoCallbacksController;
use App\Http\Controllers\SsoRedirectsController;
use App\Http\Controllers\StyledAvatarsController;
use App\Http\Controllers\TeamAccessRequestsController;
use App\Http\Controllers\TeamAddressesController;
use App\Http\Controllers\TeamDataController;
use App\Http\Controllers\TeamDefaultPokerDecksController;
use App\Http\Controllers\TeamDefaultRetroTemplatesController;
use App\Http\Controllers\TeamEstimatesController;
use App\Http\Controllers\TeamFacilitatorsController;
use App\Http\Controllers\TeamGameRoomsController;
use App\Http\Controllers\TeamHealthChecksController;
use App\Http\Controllers\TeamHealthStatementArchivalsController;
use App\Http\Controllers\TeamHealthStatementOrdersController;
use App\Http\Controllers\TeamHealthStatementsController;
use App\Http\Controllers\TeamInsightsController;
use App\Http\Controllers\TeamInvitationsController;
use App\Http\Controllers\TeamInviteLinksController;
use App\Http\Controllers\TeamMemberRolesController;
use App\Http\Controllers\TeamMembersController;
use App\Http\Controllers\TeamPokerGamesController;
use App\Http\Controllers\TeamRetrosController;
use App\Http\Controllers\TeamRitualsController;
use App\Http\Controllers\TeamsController;
use App\Http\Controllers\TeamSessionsController;
use App\Http\Controllers\TeamSettingsController;
use App\Http\Controllers\TeamSprintsController;
use App\Http\Controllers\TeamSprintStartsController;
use App\Http\Controllers\TeamSurveyJoinsController;
use App\Http\Controllers\TeamSurveys\TeamSurveyAnswersController;
use App\Http\Controllers\TeamSurveys\TeamSurveyComparisonsController;
use App\Http\Controllers\TeamSurveys\TeamSurveyDuplicatesController;
use App\Http\Controllers\TeamSurveys\TeamSurveyExportsController;
use App\Http\Controllers\TeamSurveys\TeamSurveyGuestTokensController;
use App\Http\Controllers\TeamSurveys\TeamSurveyQuestionDuplicatesController;
use App\Http\Controllers\TeamSurveys\TeamSurveyQuestionOrdersController;
use App\Http\Controllers\TeamSurveys\TeamSurveyQuestionsController;
use App\Http\Controllers\TeamSurveys\TeamSurveyResultsController;
use App\Http\Controllers\TeamSurveys\TeamSurveysController;
use App\Http\Controllers\TeamSurveys\TeamSurveySnapshotsController;
use App\Http\Controllers\TeamSurveys\TeamSurveyStatusesController;
use App\Http\Controllers\TeamSurveys\TeamSurveySubmissionsController;
use App\Http\Controllers\TeamWhiteboardsController;
use App\Http\Controllers\WhiteboardJoinsController;
use App\Http\Controllers\Whiteboards\WhiteboardDuplicatesController;
use App\Http\Controllers\Whiteboards\WhiteboardElementsController;
use App\Http\Controllers\Whiteboards\WhiteboardFacilitatorsController;
use App\Http\Controllers\Whiteboards\WhiteboardFilesController;
use App\Http\Controllers\Whiteboards\WhiteboardGuestTokensController;
use App\Http\Controllers\Whiteboards\WhiteboardsController;
use App\Http\Controllers\Whiteboards\WhiteboardSettingsController;
use App\Http\Controllers\Whiteboards\WhiteboardSnapshotsController;
use App\Http\Controllers\Whiteboards\WhiteboardTemplatesController;
use App\Http\Controllers\Whiteboards\WhiteboardTimerExtensionsController;
use App\Http\Controllers\Whiteboards\WhiteboardTimersController;
use App\Http\Controllers\WorkspaceActionItemBulkDeletionsController;
use App\Http\Controllers\WorkspaceActionItemBulkUpdatesController;
use App\Http\Controllers\WorkspaceActionItemCommentsController;
use App\Http\Controllers\WorkspaceActionItemCsvExportsController;
use App\Http\Controllers\WorkspaceActionItemsController;
use App\Http\Controllers\WorkspaceActionItemSubtasksController;
use App\Http\Controllers\WorkspaceDetailsController;
use App\Http\Controllers\WorkspaceInvitationResendsController;
use App\Http\Controllers\WorkspaceInvitationsController;
use App\Http\Controllers\WorkspaceMembersController;
use App\Http\Controllers\WorkspacePokerDecksController;
use App\Http\Controllers\WorkspacesController;
use App\Http\Controllers\WorkspaceTemplatesController;
use App\Http\Controllers\WorkspaceWhiteboardTemplatesController;
use App\Http\Middleware\EnsureIntegrationProviderEnabled;
use App\Http\Middleware\RefuseObserverWrites;
use App\Http\Middleware\RememberCurrentWorkspace;
use App\Http\Middleware\ResolveGamePlayer;
use App\Http\Middleware\ResolvePokerPlayer;
use App\Http\Middleware\ResolveRetroParticipant;
use App\Http\Middleware\ResolveSurveyRespondent;
use App\Http\Middleware\ResolveWhiteboardMember;
use App\Support\Avatars\AvatarPhotos;
use App\Support\Branding\BrandAssets;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

Route::patterns([
    ...array_fill_keys([
        'accessRequest', 'actionItem', 'actionItemComment', 'actionItemSubtask', 'card', 'column', 'comment', 'delivery',
        'externalLink', 'integration', 'member', 'notification', 'player', 'pokerDeck', 'question', 'round',
        'socialAccount', 'sprint', 'suggestedAction', 'survey', 'surveyComment', 'task', 'template', 'user',
        'whiteboardTemplate',
    ], '[\da-fA-F]{8}-[\da-fA-F]{4}-[\da-fA-F]{4}-[\da-fA-F]{4}-[\da-fA-F]{12}'),
    'source' => 'jira|linear|jira_dc|github',
]);

Route::get('/', fn (Request $request) => $request->user() === null
    ? to_route('login')
    : to_route('dashboard'))->name('home');

Route::get('invitations/{token}', [InvitationLinksController::class, 'show'])->name('invitations.show');
Route::get('invite/{token}', [InviteLinksController::class, 'show'])->middleware('throttle:30,1,inviteLinkPages')->name('inviteLinks.show');

Route::get('dev/design-system', [DesignSystemPagesController::class, 'index'])->name('dev.designSystem.index');
Route::get('dev/design-system/{section}', [DesignSystemPagesController::class, 'show'])->name('dev.designSystem.show');
Route::middleware(['signed', 'throttle:30,1,mailUnsubscribes'])->group(function (): void {
    Route::get('reminder-unsubscribe/{user}', [ReminderUnsubscribesController::class, 'show'])->name('reminderUnsubscribes.show');
    Route::post('reminder-unsubscribe/{user}', [ReminderUnsubscribesController::class, 'store'])->name('reminderUnsubscribes.store');
    Route::get('recap-unsubscribe/{user}', [RecapUnsubscribesController::class, 'show'])->name('recapUnsubscribes.show');
    Route::post('recap-unsubscribe/{user}', [RecapUnsubscribesController::class, 'store'])->name('recapUnsubscribes.store');
});

Route::get('dev/mail/{mail}', [MailPreviewsController::class, 'show'])->where('mail', '[a-z-]+')->name('dev.mail.show');

Route::get('avatars/{seed}.svg', [AvatarsController::class, 'show'])->where('seed', '[a-f0-9]{32}')->name('avatars.show');
// Outside the web group, like the brand assets below.
Route::get('avatars/{style}/{seed}.svg', [StyledAvatarsController::class, 'show'])
    ->where(['style' => '[a-z0-9-]+', 'seed' => '[a-f0-9]{32}'])
    ->withoutMiddleware('web')
    ->name('styledAvatars.show');
Route::get('avatar-photos/{file}', [AvatarPhotosController::class, 'show'])->where('file', AvatarPhotos::FilePattern)
    ->withoutMiddleware('web')
    ->name('avatarPhotos.show');
// Outside the web group: a public, immutable response must not carry a session cookie.
Route::get('brand/{asset}', [BrandAssetsController::class, 'show'])->where('asset', BrandAssets::RoutePattern)
    ->withoutMiddleware('web')
    ->name('brand.show');
Route::get('emoji-data/{version}/{locale}/{file}', [EmojiDataController::class, 'show'])
    ->where(['version' => '[0-9.]+', 'locale' => '[a-z-]+', 'file' => '[a-z]+\.json'])
    ->middleware('throttle:120,1,emojiData')
    ->name('emoji-data.show');

Route::get('gifs/{gif}/{size}', [GifsController::class, 'show'])
    ->where(['gif' => '[A-Za-z0-9_-]{1,64}', 'size' => 'preview|full'])
    ->middleware('throttle:240,1,gifs')
    ->name('gifs.show');

Route::post('invitations/{token}/acceptance', [InvitationAcceptancesController::class, 'store'])
    ->middleware('auth')
    ->name('invitations.acceptance.store');
Route::post('invitations/{token}/decline', [InvitationDeclinesController::class, 'store'])
    ->middleware('throttle:invitationDeclines')
    ->name('invitations.decline.store');
Route::post('invite/{token}/membership', [InviteLinkMembershipsController::class, 'store'])
    ->middleware(['auth', 'verified', 'throttle:10,1,inviteLinkJoins'])
    ->name('inviteLinks.membership.store');

/*
 * Outside the guest group: a signed-in user comes back here after asking to
 * link a provider (SsoIntent); without that intent the callback does nothing.
 */
Route::get('auth/{provider}/callback', [SsoCallbacksController::class, 'show'])->name('sso.callback');

Route::middleware('guest')->group(function (): void {
    Route::post('invitations/{token}/account', [InvitationAccountsController::class, 'store'])
        ->middleware('throttle:invitationAccounts')
        ->name('invitations.account.store');
    Route::get('auth/{provider}/redirect', [SsoRedirectsController::class, 'show'])->name('sso.redirect');
    Route::post('magic-link', [MagicLinksController::class, 'store'])->middleware('throttle:magicLinks')->name('magicLinks.store');
    Route::get('magic-link/{token}', [MagicLinksController::class, 'show'])
        ->where('token', '[A-Za-z0-9]{64}')
        ->middleware('throttle:20,1,magicLinkOpens')
        ->name('magicLinks.show');
    Route::post('magic-link/{token}/session', [MagicLinkSessionsController::class, 'store'])
        ->where('token', '[A-Za-z0-9]{64}')
        ->middleware('throttle:20,1,magicLinkOpens')
        ->name('magicLinks.sessions.store');
    Route::post('two-factor-challenge/email-code', [EmailChallengeCodesController::class, 'store'])
        ->middleware('throttle:6,1,emailChallengeCodes')
        ->name('twoFactor.emailCodes.store');
    Route::post('two-factor-challenge/email', [EmailCodeChallengesController::class, 'store'])
        ->middleware('throttle:two-factor')
        ->name('twoFactor.emailChallenges.store');
});

Route::put('locale', [LocalesController::class, 'update'])->name('locale.update');

Route::pattern('statement', '[A-Za-z0-9_-]{1,64}');

Route::middleware(['auth', 'verified'])->group(function (): void {
    Route::get('dashboard', [CurrentWorkspaceController::class, 'show'])->name('dashboard');
    Route::get('onboarding', [OnboardingsController::class, 'show'])->name('onboarding.show');
    Route::put('onboarding/workspace', [OnboardingWorkspacesController::class, 'update'])->name('onboarding.workspace.update');
    Route::put('onboarding/team', [OnboardingTeamsController::class, 'update'])->name('onboarding.team.update');
    Route::post('onboarding/invitations', [OnboardingInvitationsController::class, 'store'])->middleware('throttle:10,1,teamInvitations')->name('onboarding.invitations.store');
    Route::put('onboarding/step', [OnboardingStepsController::class, 'update'])->name('onboarding.step.update');
    Route::post('onboarding/completion', [OnboardingCompletionsController::class, 'store'])->name('onboarding.completion.store');
    Route::get('about', [AboutPagesController::class, 'show'])->name('about.show');
    Route::get('t/{slug}', [TeamAddressesController::class, 'show'])
        ->where('slug', '[a-z0-9]+(?:-[a-z0-9]+)*')
        ->middleware('throttle:60,1,teamAddresses')
        ->name('teamAddresses.show');
    Route::get('workspaces/create', [WorkspacesController::class, 'create'])->name('workspaces.create');
    Route::post('workspaces', [WorkspacesController::class, 'store'])->name('workspaces.store');
    Route::get('notifications', [NotificationsController::class, 'index'])->name('notifications.index');
    Route::post('notifications/read-all', [ReadAllNotificationsController::class, 'store'])->name('notifications.readAll');
    Route::patch('notifications/{notification}', [NotificationsController::class, 'update'])->name('notifications.update');
    Route::get('search', [SearchResultsController::class, 'index'])->middleware('throttle:60,1,search')->name('search.index');
    Route::get('recent-sessions', [RecentSessionsController::class, 'index'])->middleware('throttle:60,1,recent-sessions')->name('recentSessions.index');

    Route::get('integrations/jira-dc/callback', [IntegrationCallbacksController::class, 'show'])
        ->defaults('provider', 'jira_dc')
        ->middleware(EnsureIntegrationProviderEnabled::class)
        ->name('integrations.jiraDataCenter.callback');

    Route::get('integrations/{provider}/callback', [IntegrationCallbacksController::class, 'show'])
        ->whereIn('provider', ['slack', 'jira', 'linear', 'github'])
        ->middleware(EnsureIntegrationProviderEnabled::class)
        ->name('integrations.callback');

    Route::prefix('w/{workspace}')
        ->middleware(['can:view,workspace', RememberCurrentWorkspace::class])
        ->scopeBindings()
        ->group(function (): void {
            Route::get('/', [WorkspacesController::class, 'show'])->name('workspaces.show');
            Route::delete('/', [WorkspacesController::class, 'destroy'])->name('workspaces.destroy');
            Route::put('details', [WorkspaceDetailsController::class, 'update'])->name('workspaces.details.update');

            Route::post('teams', [TeamsController::class, 'store'])->name('teams.store');
            Route::get('teams/{team}', [TeamsController::class, 'show'])->name('teams.show');
            Route::get('teams/{team}/sessions', [TeamSessionsController::class, 'index'])->name('teams.sessions.index');
            Route::patch('teams/{team}', [TeamsController::class, 'update'])->name('teams.update');
            Route::delete('teams/{team}', [TeamsController::class, 'destroy'])->name('teams.destroy');
            Route::post('teams/{team}/retros', [TeamRetrosController::class, 'store'])->name('teams.retros.store');
            Route::post('teams/{team}/poker-games', [TeamPokerGamesController::class, 'store'])->name('teams.pokerGames.store');
            Route::post('teams/{team}/whiteboards', [TeamWhiteboardsController::class, 'store'])->name('teams.whiteboards.store');
            Route::post('teams/{team}/surveys', [TeamSurveysController::class, 'store'])->name('teams.surveys.store');
            Route::get('teams/{team}/estimates', [TeamEstimatesController::class, 'index'])->name('teams.estimates.index');
            Route::get('teams/{team}/poker-decks', [PokerDecksController::class, 'index'])->name('teams.pokerDecks.index');
            Route::post('teams/{team}/poker-decks', [PokerDecksController::class, 'store'])->name('teams.pokerDecks.store');
            Route::patch('teams/{team}/poker-decks/{pokerDeck}', [PokerDecksController::class, 'update'])->name('teams.pokerDecks.update');
            Route::delete('teams/{team}/poker-decks/{pokerDeck}', [PokerDecksController::class, 'destroy'])->name('teams.pokerDecks.destroy');
            Route::put('teams/{team}/default-poker-deck', [TeamDefaultPokerDecksController::class, 'update'])->name('teams.defaultPokerDeck.update');
            Route::put('teams/{team}/default-retro-template', [TeamDefaultRetroTemplatesController::class, 'update'])->name('teams.defaultRetroTemplate.update');
            Route::post('teams/{team}/poker-decks/{pokerDeck}/duplicate', [PokerDeckDuplicatesController::class, 'store'])->name('teams.pokerDecks.duplicate.store');
            Route::get('teams/{team}/games', [TeamGameRoomsController::class, 'index'])->name('teams.games.index');
            Route::post('teams/{team}/games', [TeamGameRoomsController::class, 'store'])->name('teams.games.store');
            Route::get('teams/{team}/poker-imports/{source}/containers', [TeamPokerImportContainersController::class, 'index'])->name('teams.pokerImports.containers.index');
            Route::get('teams/{team}/poker-imports/{source}/iterations', [TeamPokerImportIterationsController::class, 'index'])->name('teams.pokerImports.iterations.index');
            Route::post('teams/{team}/poker-imports/{source}/preview', [TeamPokerImportPreviewsController::class, 'store'])->name('teams.pokerImports.preview.store');
            Route::post('teams/{team}/sprints', [TeamSprintsController::class, 'store'])->name('teams.sprints.store');
            Route::patch('teams/{team}/sprints/{sprint}', [TeamSprintsController::class, 'update'])->name('teams.sprints.update');
            Route::delete('teams/{team}/sprints/{sprint}', [TeamSprintsController::class, 'destroy'])->name('teams.sprints.destroy');
            Route::post('teams/{team}/sprint-starts', [TeamSprintStartsController::class, 'store'])->name('teams.sprintStarts.store');
            Route::get('teams/{team}/rituals', [TeamRitualsController::class, 'show'])->name('teams.rituals.show');
            Route::put('teams/{team}/rituals', [TeamRitualsController::class, 'update'])->name('teams.rituals.update');
            Route::put('teams/{team}/facilitators', [TeamFacilitatorsController::class, 'update'])->name('teams.facilitators.update');
            Route::get('teams/{team}/settings', [TeamSettingsController::class, 'show'])->name('teams.settings.show');
            Route::get('teams/{team}/members', [TeamMembersController::class, 'index'])->name('teams.members.index');
            Route::get('teams/{team}/data', [TeamDataController::class, 'show'])->name('teams.data.show');

            Route::middleware(EnsureIntegrationProviderEnabled::class)->group(function (): void {
                Route::get('teams/{team}/integrations', [TeamIntegrationsController::class, 'index'])->name('teams.integrations.index');
                Route::get('teams/{team}/integrations/{provider}/connect', [IntegrationAuthorizationsController::class, 'create'])
                    ->whereIn('provider', ['slack', 'jira', 'linear', 'jira_dc', 'github'])
                    ->name('teams.integrations.connect');
                Route::post('teams/{team}/integrations/telegram/code', [TelegramConnectCodesController::class, 'store'])
                    ->middleware([EnsureIntegrationProviderEnabled::class.':telegram', 'throttle:10,1,telegramCodes'])
                    ->name('teams.integrations.telegramCode.store');
                Route::post('teams/{team}/integrations/jira-dc/token', [JiraDataCenterTokensController::class, 'store'])
                    ->middleware([EnsureIntegrationProviderEnabled::class.':jira_dc', 'throttle:10,1,jiraDataCenterTokens'])
                    ->name('teams.integrations.jiraDataCenterToken.store');
                Route::post('teams/{team}/integrations/{provider}', [IntegrationUrlsController::class, 'store'])
                    ->whereIn('provider', ['msteams', 'mattermost', 'webhook'])
                    ->middleware('throttle:10,1,integrationUrls')
                    ->name('teams.integrations.urls.store');
                Route::patch('teams/{team}/integrations/{integration}', [TeamIntegrationsController::class, 'update'])
                    ->middleware('throttle:60,1,integrationUpdates')
                    ->name('teams.integrations.update');
                Route::post('teams/{team}/integrations/{integration}/detection', [JiraFieldDetectionsController::class, 'store'])
                    ->middleware('throttle:10,1,jiraFieldDetections')
                    ->name('teams.integrations.detection.store');
                Route::get('teams/{team}/integrations/{integration}/user-mappings', [IntegrationUserMappingsController::class, 'index'])
                    ->name('teams.integrations.userMappings.index');
                Route::post('teams/{team}/integrations/{integration}/user-mappings/match', [IntegrationUserMatchesController::class, 'store'])
                    ->middleware('throttle:3,1,userMappingMatches')
                    ->name('teams.integrations.userMappings.match.store');
                Route::put('teams/{team}/integrations/{integration}/user-mappings/{user}', [IntegrationUserMappingsController::class, 'update'])
                    ->name('teams.integrations.userMappings.update');
                Route::delete('teams/{team}/integrations/{integration}/user-mappings/{user}', [IntegrationUserMappingsController::class, 'destroy'])
                    ->name('teams.integrations.userMappings.destroy');
                Route::get('teams/{team}/integrations/{integration}/accounts', [IntegrationAccountsController::class, 'index'])
                    ->middleware('throttle:30,1,integrationAccountSearches')
                    ->name('teams.integrations.accounts.index');
                Route::get('teams/{team}/integrations/{integration}/priorities', [IntegrationPrioritiesController::class, 'index'])
                    ->middleware('throttle:30,1,integrationPriorities')
                    ->name('teams.integrations.priorities.index');
                Route::get('teams/{team}/integrations/{integration}/statuses', [IntegrationStatusesController::class, 'index'])
                    ->middleware('throttle:30,1,integrationStatuses')
                    ->name('teams.integrations.statuses.index');
                Route::get('teams/{team}/integrations/{integration}/targets', [IntegrationTargetsController::class, 'index'])
                    ->middleware('throttle:30,1,integrationTargets')
                    ->name('teams.integrations.targets.index');
                Route::delete('teams/{team}/integrations/{integration}', [TeamIntegrationsController::class, 'destroy'])
                    ->name('teams.integrations.destroy');
                Route::post('teams/{team}/integrations/{integration}/test', [IntegrationTestsController::class, 'store'])
                    ->middleware('throttle:10,1,integrationTests')
                    ->name('teams.integrations.test.store');
                Route::get('teams/{team}/integrations/{integration}/webhook', [TrackerWebhooksController::class, 'show'])
                    ->middleware('throttle:10,1,trackerWebhookDetails')
                    ->name('teams.integrations.trackerWebhook.show');
                Route::post('teams/{team}/integrations/{integration}/webhook', [TrackerWebhooksController::class, 'store'])
                    ->middleware('throttle:10,1,trackerWebhooks')
                    ->name('teams.integrations.trackerWebhook.store');
                Route::post('teams/{team}/integrations/{integration}/secret', [WebhookSecretsController::class, 'store'])
                    ->middleware('throttle:10,1,webhookSecrets')
                    ->name('teams.integrations.secret.store');
                Route::get('teams/{team}/integrations/{integration}/deliveries', [WebhookDeliveriesController::class, 'index'])
                    ->middleware('throttle:60,1,webhookDeliveries')
                    ->name('teams.integrations.deliveries.index');
                Route::get('teams/{team}/integrations/{integration}/deliveries/{delivery}', [WebhookDeliveriesController::class, 'show'])
                    ->middleware('throttle:60,1,webhookDeliveryDetails')
                    ->name('teams.integrations.deliveries.show');
                Route::post('teams/{team}/integrations/{integration}/deliveries/{delivery}/redelivery', [WebhookRedeliveriesController::class, 'store'])
                    ->middleware('throttle:10,1,webhookRedeliveries')
                    ->name('teams.integrations.deliveries.redelivery.store');
            });

            Route::post('teams/{team}/access-requests', [TeamAccessRequestsController::class, 'store'])
                ->middleware('throttle:5,60,teamAccessRequests')
                ->name('teams.accessRequests.store');
            Route::patch('teams/{team}/access-requests/{accessRequest}', [TeamAccessRequestsController::class, 'update'])
                ->name('teams.accessRequests.update');
            Route::post('teams/{team}/members', [TeamMembersController::class, 'store'])->name('teams.members.store');
            Route::delete('teams/{team}/members/{member}', [TeamMembersController::class, 'destroy'])->name('teams.members.destroy');
            Route::put('teams/{team}/members/{member}/role', [TeamMemberRolesController::class, 'update'])->name('teams.members.role.update');

            Route::get('teams/{team}/insights', [TeamInsightsController::class, 'show'])->name('teams.insights.show');
            Route::get('teams/{team}/health-check', [TeamHealthChecksController::class, 'show'])->name('teams.healthCheck.show');
            Route::post('teams/{team}/health-statements', [TeamHealthStatementsController::class, 'store'])->name('teams.healthStatements.store');
            Route::patch('teams/{team}/health-statements/{statement}', [TeamHealthStatementsController::class, 'update'])->name('teams.healthStatements.update');
            Route::put('teams/{team}/health-statement-order', [TeamHealthStatementOrdersController::class, 'update'])->name('teams.healthStatements.order.update');
            Route::put('teams/{team}/health-statements/{statement}/archival', [TeamHealthStatementArchivalsController::class, 'update'])->name('teams.healthStatements.archival.update');
            Route::delete('teams/{team}/health-statements/{statement}/archival', [TeamHealthStatementArchivalsController::class, 'destroy'])->name('teams.healthStatements.archival.destroy');

            Route::get('members', [WorkspaceMembersController::class, 'index'])->name('workspaces.members.index');
            Route::patch('members/{member}', [WorkspaceMembersController::class, 'update'])->name('workspaces.members.update');
            Route::delete('members/{member}', [WorkspaceMembersController::class, 'destroy'])->name('workspaces.members.destroy');
            Route::post('invitations', [WorkspaceInvitationsController::class, 'store'])->name('workspaces.invitations.store')->middleware('throttle:20,1,workspaceInvitations');
            Route::delete('invitations/{invitation}', [WorkspaceInvitationsController::class, 'destroy'])->name('workspaces.invitations.destroy');
            Route::post('invitations/{invitation}/resend', [WorkspaceInvitationResendsController::class, 'store'])->name('workspaces.invitations.resend.store')->middleware('throttle:20,1,invitationResends');
            Route::post('teams/{team}/invitations', [TeamInvitationsController::class, 'store'])->name('teams.invitations.store')->middleware('throttle:10,1,teamInvitations');
            Route::post('teams/{team}/invite-link', [TeamInviteLinksController::class, 'store'])->name('teams.inviteLink.store')->middleware('throttle:10,1,inviteLinks');
            Route::delete('teams/{team}/invite-link', [TeamInviteLinksController::class, 'destroy'])->name('teams.inviteLink.destroy')->middleware('throttle:10,1,inviteLinks');

            Route::get('templates', [WorkspaceTemplatesController::class, 'index'])->name('workspaces.templates.index');
            Route::post('templates', [WorkspaceTemplatesController::class, 'store'])->name('workspaces.templates.store');
            Route::patch('templates/{template}', [WorkspaceTemplatesController::class, 'update'])->name('workspaces.templates.update');
            Route::delete('templates/{template}', [WorkspaceTemplatesController::class, 'destroy'])->name('workspaces.templates.destroy');
            Route::post('poker-decks', [WorkspacePokerDecksController::class, 'store'])->name('workspaces.pokerDecks.store');
            Route::patch('poker-decks/{pokerDeck}', [WorkspacePokerDecksController::class, 'update'])->name('workspaces.pokerDecks.update');
            Route::delete('poker-decks/{pokerDeck}', [WorkspacePokerDecksController::class, 'destroy'])->name('workspaces.pokerDecks.destroy');
            Route::patch('whiteboard-templates/{whiteboardTemplate}', [WorkspaceWhiteboardTemplatesController::class, 'update'])->name('workspaces.whiteboardTemplates.update');
            Route::delete('whiteboard-templates/{whiteboardTemplate}', [WorkspaceWhiteboardTemplatesController::class, 'destroy'])->name('workspaces.whiteboardTemplates.destroy');

            Route::get('action-items', [WorkspaceActionItemsController::class, 'index'])->name('workspaces.actionItems.index');
            Route::post('action-items', [WorkspaceActionItemsController::class, 'store'])->name('workspaces.actionItems.store');
            Route::post('action-items/bulk-updates', [WorkspaceActionItemBulkUpdatesController::class, 'store'])->middleware('throttle:20,1,actionItemBulk')->name('workspaces.actionItemBulkUpdates.store');
            Route::post('action-items/bulk-deletions', [WorkspaceActionItemBulkDeletionsController::class, 'store'])->middleware('throttle:20,1,actionItemBulk')->name('workspaces.actionItemBulkDeletions.store');
            Route::patch('action-items/{actionItem}', [WorkspaceActionItemsController::class, 'update'])->name('workspaces.actionItems.update');
            Route::delete('action-items/{actionItem}', [WorkspaceActionItemsController::class, 'destroy'])->name('workspaces.actionItems.destroy');
            Route::get('action-items/export', [WorkspaceActionItemCsvExportsController::class, 'show'])->middleware('throttle:20,1,actionItemBulk')->name('workspaces.actionItemCsvExports.show');
            Route::get('action-items/{actionItem}/comments', [WorkspaceActionItemCommentsController::class, 'index'])->name('workspaces.actionItemComments.index');
            Route::post('action-items/{actionItem}/comments', [WorkspaceActionItemCommentsController::class, 'store'])->name('workspaces.actionItemComments.store');
            Route::patch('action-item-comments/{actionItemComment}', [WorkspaceActionItemCommentsController::class, 'update'])->name('workspaces.actionItemComments.update')->withoutScopedBindings();
            Route::delete('action-item-comments/{actionItemComment}', [WorkspaceActionItemCommentsController::class, 'destroy'])->name('workspaces.actionItemComments.destroy')->withoutScopedBindings();
            Route::post('action-items/{actionItem}/subtasks', [WorkspaceActionItemSubtasksController::class, 'store'])->name('workspaces.actionItemSubtasks.store');
            Route::patch('action-item-subtasks/{actionItemSubtask}', [WorkspaceActionItemSubtasksController::class, 'update'])->name('workspaces.actionItemSubtasks.update')->withoutScopedBindings();
            Route::delete('action-item-subtasks/{actionItemSubtask}', [WorkspaceActionItemSubtasksController::class, 'destroy'])->name('workspaces.actionItemSubtasks.destroy')->withoutScopedBindings();
            Route::get('action-items/{actionItem}/exports/preview', [WorkspaceActionItemExportPreviewsController::class, 'show'])
                ->middleware(EnsureIntegrationProviderEnabled::class)
                ->name('workspaces.actionItemExports.preview');
            Route::post('action-items/{actionItem}/exports', [WorkspaceActionItemExportsController::class, 'store'])
                ->middleware(EnsureIntegrationProviderEnabled::class)
                ->name('workspaces.actionItemExports.store');
            Route::post('action-items/{actionItem}/external-links/{externalLink}/sync', [WorkspaceActionItemLinkSyncsController::class, 'store'])
                ->middleware([EnsureIntegrationProviderEnabled::class, 'throttle:10,1,actionItemLinkSyncs'])
                ->name('workspaces.actionItemLinkSyncs.store');
        });
});

Route::get('join', [JoinCodesController::class, 'create'])->name('joinCodes.create');
Route::post('join', [JoinCodesController::class, 'store'])->name('joinCodes.store')->middleware('throttle:10,1,joinCodes');

Route::get('join/{guestToken}', [RetroJoinsController::class, 'show'])->name('retros.join.show');
Route::post('join/{guestToken}', [RetroJoinsController::class, 'store'])->name('retros.join.store')->middleware('throttle:10,1,retroJoins');

Route::prefix('retros/{retro}')
    ->whereUuid('retro')
    ->middleware([ResolveRetroParticipant::class, RefuseObserverWrites::class])
    ->scopeBindings()
    ->group(function (): void {
        Route::get('/', [RetrosController::class, 'show'])->name('retros.show');
        Route::delete('/', [RetrosController::class, 'destroy'])->name('retros.destroy');
        Route::put('phase', [RetroPhasesController::class, 'update'])->name('retros.phase.update');
        Route::put('timer', [RetroTimersController::class, 'update'])->name('retros.timer.update');
        Route::post('timer/extension', [RetroTimerExtensionsController::class, 'store'])->name('retros.timer.extension.store');
        Route::put('timer/pause', [RetroTimerPausesController::class, 'update'])->name('retros.timer.pause.update');
        Route::delete('timer/pause', [RetroTimerPausesController::class, 'destroy'])->name('retros.timer.pause.destroy');
        Route::put('cards/{card}/discussion', [CardDiscussionsController::class, 'update'])->name('retros.cards.discussion.update');
        Route::delete('cards/{card}/discussion', [CardDiscussionsController::class, 'destroy'])->name('retros.cards.discussion.destroy');
        Route::put('highlight', [RetroHighlightsController::class, 'update'])->name('retros.highlight.update');
        Route::patch('settings', [RetroSettingsController::class, 'update'])->name('retros.settings.update');
        Route::post('guest-token', [RetroGuestTokensController::class, 'store'])->name('retros.guest-token.store');
        Route::put('facilitator', [RetroFacilitatorsController::class, 'update'])->name('retros.facilitator.update');
        Route::get('snapshot', [RetroSnapshotsController::class, 'show'])->name('retros.snapshot.show');
        Route::put('roti', [RetroRotiController::class, 'update'])->name('retros.roti.update');
        Route::delete('roti', [RetroRotiController::class, 'destroy'])->name('retros.roti.destroy');
        Route::put('roti/reveal', [RetroRotiRevealsController::class, 'update'])->name('retros.roti.reveal.update');
        Route::post('roti/nudges', [RetroRotiNudgesController::class, 'store'])->name('retros.roti.nudges.store');
        Route::post('health-check', [RetroHealthChecksController::class, 'store'])->name('retros.healthCheck.store');
        Route::delete('health-check', [RetroHealthChecksController::class, 'destroy'])->name('retros.healthCheck.destroy');
        Route::put('health-check/closure', [RetroHealthCheckClosuresController::class, 'update'])->name('retros.healthCheck.closure.update');
        Route::delete('health-check/closure', [RetroHealthCheckClosuresController::class, 'destroy'])->name('retros.healthCheck.closure.destroy');
        Route::post('health-check/submission', [RetroHealthCheckSubmissionsController::class, 'store'])->name('retros.healthCheck.submission.store');
        Route::post('columns', [ColumnsController::class, 'store'])->name('retros.columns.store');
        Route::patch('columns/{column}', [ColumnsController::class, 'update'])->name('retros.columns.update');
        Route::delete('columns/{column}', [ColumnsController::class, 'destroy'])->name('retros.columns.destroy');
        Route::put('column-order', [ColumnOrdersController::class, 'update'])->name('retros.columns.order.update');
        Route::post('cards', [CardsController::class, 'store'])->name('retros.cards.store');
        Route::patch('cards/{card}', [CardsController::class, 'update'])->name('retros.cards.update');
        Route::delete('cards/{card}', [CardsController::class, 'destroy'])->name('retros.cards.destroy');
        Route::get('gifs', [RetroGifsController::class, 'index'])->name('retros.gifs.index');
        Route::put('cards/{card}/position', [CardPositionsController::class, 'update'])->name('retros.cards.position.update');
        Route::put('cards/{card}/group', [CardGroupsController::class, 'update'])->name('retros.cards.group.update');
        Route::delete('cards/{card}/group', [CardGroupsController::class, 'destroy'])->name('retros.cards.group.destroy');
        Route::put('cards/{card}/group-name', [CardGroupNamesController::class, 'update'])->name('retros.cards.group-name.update');
        Route::delete('cards/{card}/group-name', [CardGroupNamesController::class, 'destroy'])->name('retros.cards.group-name.destroy');
        Route::post('group-name-suggestions', [GroupNameSuggestionsController::class, 'store'])->name('retros.group-name-suggestions.store');
        Route::post('cards/{card}/votes', [CardVotesController::class, 'store'])->name('retros.cards.votes.store');
        Route::delete('cards/{card}/votes', [CardVotesController::class, 'destroy'])->name('retros.cards.votes.destroy');
        Route::put('voting-completion', [VotingCompletionsController::class, 'update'])->name('retros.votingCompletion.update');
        Route::delete('voting-completion', [VotingCompletionsController::class, 'destroy'])->name('retros.votingCompletion.destroy');
        Route::put('writing', [RetroWritersController::class, 'update'])->middleware('throttle:retro-writing')->name('retros.writing.update');
        Route::delete('writing', [RetroWritersController::class, 'destroy'])->middleware('throttle:retro-writing')->name('retros.writing.destroy');
        Route::put('cards/{card}/reactions', [CardReactionsController::class, 'update'])->name('retros.cards.reactions.update');
        Route::delete('cards/{card}/reactions', [CardReactionsController::class, 'destroy'])->name('retros.cards.reactions.destroy');
        Route::post('cards/{card}/comments', [CardCommentsController::class, 'store'])->name('retros.cards.comments.store');
        Route::put('cards/{card}/notes', [TopicNotesController::class, 'update'])->name('retros.cards.notes.update');
        Route::patch('comments/{comment}', [CardCommentsController::class, 'update'])->name('retros.comments.update');
        Route::delete('comments/{comment}', [CardCommentsController::class, 'destroy'])->name('retros.comments.destroy');
        Route::post('action-items', [ActionItemsController::class, 'store'])->name('retros.action-items.store');
        Route::patch('action-items/{actionItem}', [ActionItemsController::class, 'update'])->name('retros.action-items.update');
        Route::delete('action-items/{actionItem}', [ActionItemsController::class, 'destroy'])->name('retros.action-items.destroy');
        Route::get('action-items/{actionItem}/comments', [ActionItemCommentsController::class, 'index'])->name('retros.action-items.comments.index');
        Route::post('action-items/{actionItem}/comments', [ActionItemCommentsController::class, 'store'])->name('retros.action-items.comments.store');
        Route::patch('action-item-comments/{actionItemComment}', [ActionItemCommentsController::class, 'update'])->name('retros.action-items.comments.update');
        Route::delete('action-item-comments/{actionItemComment}', [ActionItemCommentsController::class, 'destroy'])->name('retros.action-items.comments.destroy');
        Route::post('action-items/{actionItem}/subtasks', [ActionItemSubtasksController::class, 'store'])->name('retros.action-items.subtasks.store');
        Route::patch('action-item-subtasks/{actionItemSubtask}', [ActionItemSubtasksController::class, 'update'])->name('retros.action-items.subtasks.update');
        Route::delete('action-item-subtasks/{actionItemSubtask}', [ActionItemSubtasksController::class, 'destroy'])->name('retros.action-items.subtasks.destroy');
        Route::get('action-items/{actionItem}/exports/preview', [RetroActionItemExportPreviewsController::class, 'show'])
            ->middleware(EnsureIntegrationProviderEnabled::class)
            ->name('retros.action-items.exports.preview');
        Route::post('action-items/{actionItem}/exports', [RetroActionItemExportsController::class, 'store'])
            ->middleware(EnsureIntegrationProviderEnabled::class)
            ->name('retros.action-items.exports.store');
        Route::post('action-items/{actionItem}/external-links/{externalLink}/sync', [RetroActionItemLinkSyncsController::class, 'store'])
            ->middleware([EnsureIntegrationProviderEnabled::class, 'throttle:10,1,actionItemLinkSyncs'])
            ->name('retros.action-items.external-links.sync.store');
        Route::post('summary', [RetroSummariesController::class, 'store'])->name('retros.summary.store');
        Route::delete('summary', [RetroSummariesController::class, 'destroy'])->name('retros.summary.destroy');
        Route::post('shares', [RetroSharesController::class, 'store'])->middleware('throttle:5,1,shares')->name('retros.shares.store');
        Route::post('results-email', [RetroResultsEmailsController::class, 'store'])->name('retros.results-email.store');
        Route::post('suggested-actions/{suggestedAction}/promotion', [SuggestedActionPromotionsController::class, 'store'])->name('retros.suggested-actions.promotion.store');
        Route::delete('suggested-actions/{suggestedAction}', [SuggestedActionsController::class, 'destroy'])->name('retros.suggested-actions.destroy');
        Route::post('survey-drafts', [SurveyDraftsController::class, 'store'])->name('retros.survey-drafts.store');
        Route::post('surveys', [SurveysController::class, 'store'])->name('retros.surveys.store');
        Route::get('surveys/{survey}', [SurveysController::class, 'show'])->name('retros.surveys.show');
        Route::patch('surveys/{survey}', [SurveysController::class, 'update'])->name('retros.surveys.update');
        Route::delete('surveys/{survey}', [SurveysController::class, 'destroy'])->name('retros.surveys.destroy');
        Route::put('surveys/{survey}/closure', [SurveyClosuresController::class, 'update'])->name('retros.surveys.closure.update');
        Route::delete('surveys/{survey}/closure', [SurveyClosuresController::class, 'destroy'])->name('retros.surveys.closure.destroy');
        Route::put('surveys/{survey}/response', [SurveyResponsesController::class, 'update'])->name('retros.surveys.response.update');
        Route::delete('surveys/{survey}/response', [SurveyResponsesController::class, 'destroy'])->name('retros.surveys.response.destroy');
        Route::put('surveys/{survey}/reactions', [SurveyReactionsController::class, 'update'])->name('retros.surveys.reactions.update');
        Route::delete('surveys/{survey}/reactions', [SurveyReactionsController::class, 'destroy'])->name('retros.surveys.reactions.destroy');
        Route::post('surveys/{survey}/comments', [SurveyCommentsController::class, 'store'])->name('retros.surveys.comments.store');
        Route::patch('survey-comments/{surveyComment}', [SurveyCommentsController::class, 'update'])->name('retros.survey-comments.update');
        Route::delete('survey-comments/{surveyComment}', [SurveyCommentsController::class, 'destroy'])->name('retros.survey-comments.destroy');
    });

Route::get('poker/join/{guestToken}', [PokerJoinsController::class, 'show'])->name('poker.join.show');
Route::post('poker/join/{guestToken}', [PokerJoinsController::class, 'store'])->name('poker.join.store')->middleware('throttle:10,1,pokerJoins');

Route::prefix('poker/{game}')
    ->whereUuid('game')
    ->middleware([ResolvePokerPlayer::class, RefuseObserverWrites::class])
    ->scopeBindings()
    ->group(function (): void {
        Route::get('/', [PokerGamesController::class, 'show'])->name('poker.show');
        Route::get('snapshot', [PokerSnapshotsController::class, 'show'])->name('poker.snapshot.show');
        Route::post('tasks', [PokerTasksController::class, 'store'])->name('poker.tasks.store');
        Route::patch('tasks/{task}', [PokerTasksController::class, 'update'])->name('poker.tasks.update');
        Route::delete('tasks/{task}', [PokerTasksController::class, 'destroy'])->name('poker.tasks.destroy');
        Route::put('task-order', [PokerTaskOrdersController::class, 'update'])->name('poker.task-order.update');
        Route::put('current-task', [PokerCurrentTasksController::class, 'update'])->name('poker.current-task.update');
        Route::put('rounds/{round}/vote', [PokerVotesController::class, 'update'])->name('poker.rounds.vote.update');
        Route::delete('rounds/{round}/vote', [PokerVotesController::class, 'destroy'])->name('poker.rounds.vote.destroy');
        Route::post('rounds/{round}/reveal', [PokerRevealsController::class, 'store'])->name('poker.rounds.reveal.store');
        Route::post('rounds/{round}/auto-reveal', [PokerAutoRevealsController::class, 'store'])->middleware('throttle:30,1,pokerAutoReveals')->name('poker.rounds.auto-reveal.store');
        Route::put('rounds/{round}/timer', [PokerTimersController::class, 'update'])->name('poker.rounds.timer.update');
        Route::post('rounds/{round}/timer/extension', [PokerTimerExtensionsController::class, 'store'])->name('poker.rounds.timer.extension.store');

        Route::post('tasks/{task}/rounds', [PokerRoundsController::class, 'store'])->name('poker.tasks.rounds.store');
        Route::get('tasks/{task}/rounds', [PokerRoundsController::class, 'index'])->name('poker.tasks.rounds.index');
        Route::put('tasks/{task}/estimate', [PokerTaskEstimatesController::class, 'update'])->name('poker.tasks.estimate.update');
        Route::post('tasks/{task}/sync', [PokerTaskSyncsController::class, 'store'])->name('poker.tasks.sync.store');
        Route::post('tasks/{task}/estimate-conflict', [PokerEstimateConflictsController::class, 'store'])->name('poker.tasks.estimate-conflict.store');
        Route::patch('settings', [PokerSettingsController::class, 'update'])->name('poker.settings.update');
        Route::get('saved-decks', [PokerSavedDecksController::class, 'index'])->name('poker.saved-decks.index');
        Route::put('status', [PokerStatusesController::class, 'update'])->name('poker.status.update');
        Route::post('guest-token', [PokerGuestTokensController::class, 'store'])->name('poker.guest-token.store');
        Route::post('shares', [PokerSharesController::class, 'store'])->middleware('throttle:5,1,shares')->name('poker.shares.store');
        Route::get('imports/{source}/containers', [PokerImportContainersController::class, 'index'])->name('poker.imports.containers.index');
        Route::get('imports/{source}/iterations', [PokerImportIterationsController::class, 'index'])->name('poker.imports.iterations.index');
        Route::post('imports/{source}/preview', [PokerImportPreviewsController::class, 'store'])->name('poker.imports.preview.store');
        Route::post('imports/refresh', [PokerImportRefreshesController::class, 'store'])->middleware('throttle:10,1,poker-refresh')->name('poker.imports.refresh.store');
        Route::post('imports/{source}', [PokerImportsController::class, 'store'])->name('poker.imports.store');
        Route::put('facilitator', [PokerFacilitatorsController::class, 'update'])->name('poker.facilitator.update');
        Route::put('players/{player}/spectator', [PokerSpectatorsController::class, 'update'])->name('poker.players.spectator.update');
        Route::delete('/', [PokerGamesController::class, 'destroy'])->name('poker.destroy');
    });

Route::get('whiteboards/join/{guestToken}', [WhiteboardJoinsController::class, 'show'])->name('whiteboards.join.show');
Route::post('whiteboards/join/{guestToken}', [WhiteboardJoinsController::class, 'store'])->name('whiteboards.join.store')->middleware('throttle:10,1,whiteboardJoins');

Route::prefix('whiteboards/{board}')
    ->whereUuid('board')
    ->middleware([ResolveWhiteboardMember::class, RefuseObserverWrites::class])
    ->scopeBindings()
    ->group(function (): void {
        Route::get('/', [WhiteboardsController::class, 'show'])->name('whiteboards.show');
        Route::delete('/', [WhiteboardsController::class, 'destroy'])->name('whiteboards.destroy');
        Route::get('snapshot', [WhiteboardSnapshotsController::class, 'show'])->name('whiteboards.snapshot.show');
        Route::patch('settings', [WhiteboardSettingsController::class, 'update'])->name('whiteboards.settings.update');
        Route::post('guest-token', [WhiteboardGuestTokensController::class, 'store'])->name('whiteboards.guestToken.store');
        Route::put('facilitator', [WhiteboardFacilitatorsController::class, 'update'])->name('whiteboards.facilitator.update');
        Route::put('timer', [WhiteboardTimersController::class, 'update'])->name('whiteboards.timer.update');
        Route::post('timer/extension', [WhiteboardTimerExtensionsController::class, 'store'])->name('whiteboards.timer.extension.store');
        Route::get('elements', [WhiteboardElementsController::class, 'index'])->name('whiteboards.elements.index');
        Route::put('elements', [WhiteboardElementsController::class, 'update'])->name('whiteboards.elements.update')->middleware('throttle:whiteboard-writes');
        Route::post('files', [WhiteboardFilesController::class, 'store'])->name('whiteboards.files.store');
        Route::get('files/{fileId}', [WhiteboardFilesController::class, 'show'])->name('whiteboards.files.show')->where('fileId', '[A-Za-z0-9_-]{1,64}');
        Route::post('template', [WhiteboardTemplatesController::class, 'store'])->name('whiteboards.template.store');
        Route::post('duplicate', [WhiteboardDuplicatesController::class, 'store'])->name('whiteboards.duplicate.store');
    });

Route::get('surveys/join/{guestToken}', [TeamSurveyJoinsController::class, 'show'])->name('surveys.join.show');
Route::post('surveys/join/{guestToken}', [TeamSurveyJoinsController::class, 'store'])->name('surveys.join.store')->middleware('throttle:10,1,surveyJoins');

Route::prefix('surveys/{teamSurvey}')
    ->whereUuid('teamSurvey')
    ->middleware([ResolveSurveyRespondent::class, RefuseObserverWrites::class])
    ->scopeBindings()
    ->group(function (): void {
        Route::get('/', [TeamSurveysController::class, 'show'])->name('surveys.show');
        Route::get('edit', [TeamSurveysController::class, 'edit'])->name('surveys.edit');
        Route::delete('/', [TeamSurveysController::class, 'destroy'])->name('surveys.destroy');
        Route::patch('/', [TeamSurveysController::class, 'update'])->name('surveys.update');
        Route::post('questions', [TeamSurveyQuestionsController::class, 'store'])->name('surveys.questions.store');
        Route::patch('questions/{question}', [TeamSurveyQuestionsController::class, 'update'])->name('surveys.questions.update');
        Route::delete('questions/{question}', [TeamSurveyQuestionsController::class, 'destroy'])->name('surveys.questions.destroy');
        Route::put('question-order', [TeamSurveyQuestionOrdersController::class, 'update'])->name('surveys.questionOrder.update');
        Route::post('questions/{question}/duplicate', [TeamSurveyQuestionDuplicatesController::class, 'store'])->name('surveys.questions.duplicate.store');
        Route::get('snapshot', [TeamSurveySnapshotsController::class, 'show'])->name('surveys.snapshot.show');
        Route::get('results', [TeamSurveyResultsController::class, 'show'])->name('surveys.results.show');
        Route::get('comparison', [TeamSurveyComparisonsController::class, 'show'])->name('surveys.comparison.show');
        Route::get('export', [TeamSurveyExportsController::class, 'show'])->name('surveys.export.show');
        Route::post('duplicate', [TeamSurveyDuplicatesController::class, 'store'])->name('surveys.duplicate.store');
        Route::post('guest-token', [TeamSurveyGuestTokensController::class, 'store'])->name('surveys.guestToken.store');
        Route::put('status', [TeamSurveyStatusesController::class, 'update'])->name('surveys.status.update');
        Route::put('questions/{question}/answer', [TeamSurveyAnswersController::class, 'update'])->name('surveys.answers.update');
        Route::delete('questions/{question}/answer', [TeamSurveyAnswersController::class, 'destroy'])->name('surveys.answers.destroy');
        Route::post('submission', [TeamSurveySubmissionsController::class, 'store'])->name('surveys.submission.store');
        Route::delete('submission', [TeamSurveySubmissionsController::class, 'destroy'])->name('surveys.submission.destroy');
    });

Route::get('play/{guestToken}', [GameJoinsController::class, 'show'])->name('games.join.show');
Route::post('play/{guestToken}', [GameJoinsController::class, 'store'])->name('games.join.store')->middleware('throttle:10,1,game-join');

Route::prefix('games/{room}')
    ->whereUuid('room')
    ->middleware([ResolveGamePlayer::class, RefuseObserverWrites::class])
    ->scopeBindings()
    ->group(function (): void {
        Route::get('/', [GameRoomsController::class, 'show'])->name('games.show');
        Route::get('snapshot', [GameSnapshotsController::class, 'show'])->name('games.snapshot.show');
        Route::patch('/', [GameRoomsController::class, 'update'])->name('games.update');
        Route::delete('/', [GameRoomsController::class, 'destroy'])->name('games.destroy');
        Route::post('guest-token', [GameGuestTokensController::class, 'store'])->name('games.guest-token.store');
        Route::put('host', [GameHostsController::class, 'update'])->name('games.host.update');
        Route::put('game', [GameSwitchesController::class, 'update'])->name('games.game.update');
        Route::post('rounds', [GameRoundsController::class, 'store'])->name('games.rounds.store');
        Route::get('rounds', [GameRoundsController::class, 'index'])->name('games.rounds.index');
        Route::get('rounds/{round}', [GameRoundsController::class, 'show'])->name('games.rounds.show');
        Route::put('timer', [GameTimersController::class, 'update'])->name('games.timer.update');
        Route::post('timer/extension', [GameTimerExtensionsController::class, 'store'])->name('games.timer.extension.store');
        Route::delete('scores', [GameScoresController::class, 'destroy'])->name('games.scores.destroy');
        Route::post('shares', [GameSharesController::class, 'store'])->middleware('throttle:5,1,shares')->name('games.shares.store');
        Route::post('rounds/{round}/pass', [GameRoundPassesController::class, 'store'])->name('games.rounds.pass.store');
        Route::post('rounds/{round}/letters', [GameLettersController::class, 'store'])->name('games.rounds.letters.store');
        Route::get('rounds/{round}/secret', [GameRoundSecretsController::class, 'show'])->name('games.rounds.secret.show');
        Route::post('rounds/{round}/hints', [GameRoundHintsController::class, 'store'])->name('games.rounds.hints.store');
        Route::post('rounds/{round}/guesses', [GameGuessesController::class, 'store'])->name('games.rounds.guesses.store');
        Route::post('rounds/{round}/drawing-ops', [GameDrawingOpsController::class, 'store'])->name('games.rounds.drawing-ops.store');
        Route::delete('rounds/{round}/drawing-ops/last', [GameLastDrawingOpsController::class, 'destroy'])->name('games.rounds.drawing-ops.last.destroy');
        Route::delete('rounds/{round}/drawing', [GameDrawingsController::class, 'destroy'])->name('games.rounds.drawing.destroy');
        Route::put('rounds/{round}/clue', [GameRoundCluesController::class, 'update'])->name('games.rounds.clue.update');
        Route::put('rounds/{round}/question', [GameQuestionsController::class, 'update'])->name('games.rounds.question.update');
        Route::put('rounds/{round}/answer', [GameAnswersController::class, 'update'])->name('games.rounds.answer.update');
        Route::delete('rounds/{round}/answer', [GameAnswersController::class, 'destroy'])->name('games.rounds.answer.destroy');
        Route::post('rounds/{round}/reveal', [GameRevealsController::class, 'store'])->name('games.rounds.reveal.store');
        Route::put('rounds/{round}/vote', [GameVotesController::class, 'update'])->name('games.rounds.vote.update');
        Route::delete('rounds/{round}/vote', [GameVotesController::class, 'destroy'])->name('games.rounds.vote.destroy');
        Route::post('rounds/{round}/close', [GameClosuresController::class, 'store'])->name('games.rounds.close.store');
        Route::post('rounds/{round}/turn', [GameTurnsController::class, 'store'])->name('games.rounds.turn.store');
        Route::put('rounds/{round}/choice', [GameChoicesController::class, 'update'])->name('games.rounds.choice.update');
        Route::delete('rounds/{round}/choice', [GameChoicesController::class, 'destroy'])->name('games.rounds.choice.destroy');
        Route::get('gifs', [GameGifsController::class, 'index'])->name('games.gifs.index');
        Route::post('rounds/{round}/word-guesses', [GameWordGuessesController::class, 'store'])->name('games.rounds.wordGuesses.store');
        Route::put('statements', [GameStatementsController::class, 'update'])->name('games.statements.update');
        Route::delete('statements', [GameStatementsController::class, 'destroy'])->name('games.statements.destroy');
        Route::put('rounds/{round}/text-answer', [GameTextAnswersController::class, 'update'])->name('games.rounds.textAnswer.update');
        Route::delete('rounds/{round}/text-answer', [GameTextAnswersController::class, 'destroy'])->name('games.rounds.textAnswer.destroy');
        Route::post('rounds/{round}/word-changes', [GameWordChangesController::class, 'store'])->name('games.rounds.wordChanges.store');
    });

Route::post('broadcasting/auth', [BroadcastAuthorizationsController::class, 'store'])->name('broadcasting.auth');

require __DIR__.'/settings.php';
require __DIR__.'/admin.php';
