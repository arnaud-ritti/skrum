<?php

it('retries the transactions that touch nothing but the database', function (string $file, int $retried) {
    expect(substr_count(file_get_contents(base_path($file)), '}, Transactions::Attempts);'))->toBe($retried);
})->with([
    ['app/Actions/Admin/RevokeInstanceAdmin.php', 1],
    ['app/Actions/Workspaces/CreateWorkspaceInvitation.php', 1],
    ['app/Actions/Mcp/IssueMcpToken.php', 1],
    ['app/Http/Controllers/Retros/CardVotesController.php', 2],
    ['app/Http/Controllers/Retros/CardReactionsController.php', 1],
    ['app/Http/Controllers/Retros/SurveyReactionsController.php', 1],
    ['app/Http/Controllers/PokerDecksController.php', 2],
    ['app/Http/Controllers/WorkspacePokerDecksController.php', 1],
    ['app/Http/Controllers/PokerDeckDuplicatesController.php', 1],
    ['app/Http/Controllers/WorkspaceTemplatesController.php', 2],
]);

it('never retries a transaction that copies files or calls a provider', function (string $file) {
    expect(file_get_contents(base_path($file)))->not->toContain('Transactions::Attempts');
})->with([
    'app/Actions/Whiteboards/SaveWhiteboardTemplate.php',
    'app/Actions/Integrations/SaveTeamIntegration.php',
    'app/Support/Integrations/IntegrationTokens.php',
]);
