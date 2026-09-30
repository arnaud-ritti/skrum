<?php

use App\Actions\HealthCheck\FreezeHealthStatements;
use App\Enums\CardSentiment;
use App\Enums\HealthStatement;
use App\Enums\McpScope;
use App\Enums\RetroPhase;
use App\Enums\SummaryStatus;
use App\Mcp\Tools\Retro\GetHealth;
use App\Mcp\Tools\Retro\GetRoti;
use App\Mcp\Tools\Retro\ListInsights;
use App\Models\Card;
use App\Models\HealthCheckAnswer;
use App\Models\Participant;
use App\Models\Retro;
use App\Models\RetroTheme;
use App\Models\RotiVote;
use App\Models\SuggestedAction;
use App\Models\Team;
use App\Models\User;

it('offers insights only with an AI provider', function () {
    $user = teamMember(Team::factory()->create());

    expect(mcpToolNames(actingAsMcp($user)))->not->toContain('retro.board.insights.list');

    configureLlm();

    expect(mcpToolNames(actingAsMcp($user)))->toContain('retro.board.insights.list');
});

it('reports insights as not available before discussing', function () {
    configureLlm();
    $retro = Retro::factory()->inPhase(RetroPhase::Voting)->create();
    [$user] = retroMember($retro);

    expect(mcpStructured(actingAsMcp($user)->tool(ListInsights::class, ['board_id' => $retro->id])->assertOk()))
        ->toBe(['status' => 'not_available', 'themes' => [], 'suggestedActions' => []]);
});

it('lists themes with sentiment counts and suggestions with their theme', function () {
    configureLlm();
    $retro = Retro::factory()->inPhase(RetroPhase::Completed)->create([
        'summary_status' => SummaryStatus::Ready,
        'summary_generated_at' => now(),
    ]);
    [$user] = retroMember($retro);
    $theme = RetroTheme::factory()->create(['retro_id' => $retro->id, 'name' => 'Deploys']);
    $positive = Card::factory()->create(['retro_id' => $retro->id]);
    $negative = Card::factory()->create(['retro_id' => $retro->id]);
    $positive->forceFill(['sentiment' => CardSentiment::Positive])->save();
    $negative->forceFill(['sentiment' => CardSentiment::Negative])->save();
    $theme->cards()->attach([$positive->id, $negative->id]);
    $suggestion = SuggestedAction::factory()->create(['retro_id' => $retro->id, 'theme_id' => $theme->id, 'content' => 'Automate']);

    $result = mcpStructured(actingAsMcp($user)->tool(ListInsights::class, ['board_id' => $retro->id]));

    expect($result['status'])->toBe('ready')
        ->and($result['generatedAt'])->not->toBeNull()
        ->and($result['themes'][0])->toMatchArray([
            'id' => $theme->id,
            'name' => 'Deploys',
            'messageCount' => 2,
            'sentiment' => ['positive' => 1, 'neutral' => 0, 'negative' => 1],
        ])
        ->and($result['suggestedActions'][0])->toMatchArray([
            'id' => $suggestion->id,
            'content' => 'Automate',
            'themeId' => $theme->id,
            'themeName' => 'Deploys',
            'status' => 'pending',
            'actionItemId' => null,
        ]);
});

it('reports never-requested insights as not available with empty lists', function () {
    configureLlm();
    $retro = Retro::factory()->inPhase(RetroPhase::Discussing)->create();
    [$user] = retroMember($retro);

    expect(mcpStructured(actingAsMcp($user)->tool(ListInsights::class, ['board_id' => $retro->id])))
        ->toMatchArray(['status' => 'not_available', 'generatedAt' => null, 'themes' => [], 'suggestedActions' => []]);
});

/**
 * @return array{0: Retro, 1: User, 2: Participant}
 */
function mcpHealthBoard(RetroPhase $phase, bool $anonymous = false): array
{
    $retro = Retro::factory()->withHealthCheck()->inPhase($phase)->create(['is_anonymous' => $anonymous]);
    app(FreezeHealthStatements::class)->handle($retro);
    [$user, $participant] = retroMember($retro);

    return [$retro, $user, $participant];
}

it('reports a health check that never ran', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Completed)->create();
    [$user] = retroMember($retro);

    expect(mcpStructured(actingAsMcp($user)->tool(GetHealth::class, ['board_id' => $retro->id])->assertOk()))->toBe(['status' => 'not_run']);
});

it('shows progress and only the viewer own scores while collecting', function () {
    [$retro, $user, $participant] = mcpHealthBoard(RetroPhase::HealthCheck);
    $other = Participant::factory()->create(['retro_id' => $retro->id]);
    HealthCheckAnswer::factory()->create(['retro_id' => $retro->id, 'participant_id' => $participant->id, 'statement' => HealthStatement::Interaction->value, 'score' => 7]);
    HealthCheckAnswer::factory()->create(['retro_id' => $retro->id, 'participant_id' => $other->id, 'statement' => HealthStatement::Interaction->value, 'score' => 2]);

    $result = mcpStructured(actingAsMcp($user)->tool(GetHealth::class, ['board_id' => $retro->id]));
    $interaction = collect($result['categories'])->firstWhere('key', HealthStatement::Interaction->value);

    expect($result['status'])->toBe('in_progress')
        ->and($interaction['answers'])->toBe(2)
        ->and($interaction['answeredBy'])->toEqualCanonicalizing([$user->name, $other->displayName()])
        ->and($interaction)->not->toHaveKey('average')
        ->and($result['myScores'])->toBe([HealthStatement::Interaction->value => 7]);

    expect(json_encode($result))->not->toContain('"score":2');
});

it('names no one who answered on anonymous boards', function () {
    [$retro, $user, $participant] = mcpHealthBoard(RetroPhase::HealthCheck, anonymous: true);
    HealthCheckAnswer::factory()->create(['retro_id' => $retro->id, 'participant_id' => $participant->id]);

    $categories = mcpStructured(actingAsMcp($user)->tool(GetHealth::class, ['board_id' => $retro->id]))['categories'];

    expect(collect($categories)->pluck('answeredBy')->flatten()->all())->toBe([]);
});

it('shows only respondents between the health check and completion', function () {
    [$retro, $user, $participant] = mcpHealthBoard(RetroPhase::Voting);
    HealthCheckAnswer::factory()->create(['retro_id' => $retro->id, 'participant_id' => $participant->id]);

    expect(mcpStructured(actingAsMcp($user)->tool(GetHealth::class, ['board_id' => $retro->id])))->toBe(['status' => 'collected', 'respondents' => 1]);
});

it('reports averages, alignment and trend once completed, even with one answer', function () {
    [$retro, $user, $participant] = mcpHealthBoard(RetroPhase::Completed);
    $retro->update(['completed_at' => now()]);
    HealthCheckAnswer::factory()->create(['retro_id' => $retro->id, 'participant_id' => $participant->id, 'statement' => HealthStatement::Vision->value, 'score' => 8]);

    $result = mcpStructured(actingAsMcp($user)->tool(GetHealth::class, ['board_id' => $retro->id]));
    $vision = collect($result['categories'])->firstWhere('key', HealthStatement::Vision->value);

    expect($result['status'])->toBe('completed')
        ->and($vision['average'])->toEqual(8.0)
        ->and($vision['answers'])->toBe(1)
        ->and($result)->toHaveKeys(['score', 'alignment', 'alignmentLevel', 'turnout', 'topStrength', 'growthArea', 'assessment', 'trend'])
        ->and($result['turnout'])->toBe(['respondents' => 1, 'participants' => 1])
        ->and($result['trend'][0])->toMatchArray(['boardId' => $retro->id, 'sameStatements' => true])
        ->and($result['trend'][0])->toHaveKeys(['title', 'completedAt', 'score', 'delta', 'url']);
});

it('keeps ROTI ratings hidden until completion', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Voting)->create();
    [$user, $participant] = retroMember($retro);

    expect(mcpStructured(actingAsMcp($user)->tool(GetRoti::class, ['board_id' => $retro->id])->assertOk()))->toBe(['status' => 'not_started']);

    $retro->update(['phase' => RetroPhase::Discussing]);
    RotiVote::factory()->create(['retro_id' => $retro->id, 'participant_id' => $participant->id, 'score' => 4]);
    RotiVote::factory()->create(['retro_id' => $retro->id, 'score' => 1]);

    expect(mcpStructured(actingAsMcp($user)->tool(GetRoti::class, ['board_id' => $retro->id])))
        ->toBe(['status' => 'collecting', 'respondents' => 2, 'myScore' => 4]);
});

it('reports the ROTI distribution and the team trend once completed', function () {
    $team = Team::factory()->create();
    $user = teamMember($team);
    $older = Retro::factory()->for($team)->inPhase(RetroPhase::Completed)->create(['completed_at' => now()->subWeek()]);
    RotiVote::factory()->create(['retro_id' => $older->id, 'score' => 2]);
    Retro::factory()->for($team)->inPhase(RetroPhase::Completed)->create(['completed_at' => now()->subDays(3)]);
    $retro = Retro::factory()->for($team)->inPhase(RetroPhase::Completed)->create(['completed_at' => now()]);
    RotiVote::factory()->create(['retro_id' => $retro->id, 'score' => 5]);

    $result = mcpStructured(actingAsMcp($user)->tool(GetRoti::class, ['board_id' => $retro->id]));

    expect($result['status'])->toBe('completed')
        ->and($result['average'])->toEqual(5.0)
        ->and($result['respondents'])->toBe(1)
        ->and($result['myScore'])->toBeNull()
        ->and($result['distribution'])->toHaveCount(5)
        ->and(collect($result['trend'])->pluck('boardId')->all())->toBe([$older->id, $retro->id])
        ->and($result['trend'][0])->toMatchArray(['average' => 2.0, 'respondents' => 1]);
});

it('hides insights, health and ROTI of invisible boards', function (string $tool) {
    configureLlm();
    $retro = Retro::factory()->inPhase(RetroPhase::Completed)->create();

    actingAsMcp(teamMember(Team::factory()->create()), [McpScope::Read])->tool($tool, ['board_id' => $retro->id])->assertHasErrors(['Not found.']);
})->with([ListInsights::class, GetHealth::class, GetRoti::class]);
