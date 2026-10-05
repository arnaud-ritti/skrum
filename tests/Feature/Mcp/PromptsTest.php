<?php

use App\Enums\ActionItemPriority;
use App\Enums\McpScope;
use App\Enums\RetroPhase;
use App\Mcp\McpContext;
use App\Mcp\Prompts\AnalyzeRetro;
use App\Mcp\Prompts\SkrumPrompt;
use App\Mcp\Prompts\TeamHealth;
use App\Models\ActionItem;
use App\Models\Card;
use App\Models\Column;
use App\Models\Participant;
use App\Models\Retro;
use App\Models\RetroTheme;
use App\Models\RotiVote;
use App\Models\Team;
use App\Models\TeamSurvey;
use App\Models\Vote;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

it('lists both prompts for a read-only token', function () {
    $team = Team::factory()->create();
    $user = teamMember($team);

    $list = actingAsMcp($user)->prompts();

    $names = collect((fn (): array => $this->items)->call($list))->pluck('name')->sort()->values()->all();

    expect($names)->toBe(['analyze-retro', 'team-health']);
});

it('requires a visible board for analyze-retro', function () {
    $retro = Retro::factory()->create();
    [$user] = retroMember($retro);
    $foreign = Retro::factory()->create();

    actingAsMcp($user)->prompt(AnalyzeRetro::class, [])->assertHasErrors(['The board id field is required.']);
    actingAsMcp($user)->prompt(AnalyzeRetro::class, ['board_id' => 'not-a-uuid'])->assertHasErrors(['The board id field must be a valid UUID.']);
    actingAsMcp($user)->prompt(AnalyzeRetro::class, ['board_id' => $foreign->id])->assertHasErrors(['Not found.']);
});

it('embeds the board data with instructions', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Discussing)->create(['title' => 'Sprint 7 retro']);
    [$user, $participant] = retroMember($retro);
    Card::factory()->create(['retro_id' => $retro->id, 'participant_id' => $participant->id, 'content' => 'Deploys are slow']);
    ActionItem::factory()->create([
        'retro_id' => $retro->id,
        'content' => 'Automate the release checklist',
        'created_by_participant_id' => $participant->id,
        'created_by_user_id' => $user->id,
    ]);

    $response = actingAsMcp($user)->prompt(AnalyzeRetro::class, ['board_id' => $retro->id])->assertOk();
    $text = mcpPromptText($response);

    expect($text)->toContain('key themes')
        ->toContain('Never guess who wrote an anonymous message')
        ->toContain('Answer in English')
        ->and(json_encode(mcpPromptData($response)))
        ->toContain('Sprint 7 retro')
        ->toContain('Deploys are slow')
        ->toContain('Automate the release checklist');
});

it('keeps hidden and anonymous content redacted', function () {
    $writing = Retro::factory()->inPhase(RetroPhase::Writing)->create();
    [$user, $participant] = retroMember($writing);
    [, $other] = retroMember($writing);
    Card::factory()->create(['retro_id' => $writing->id, 'participant_id' => $participant->id, 'content' => 'My own visible idea']);
    Card::factory()->create(['retro_id' => $writing->id, 'participant_id' => $other->id, 'content' => 'Hidden thoughts XYZ']);

    $response = actingAsMcp($user)->prompt(AnalyzeRetro::class, ['board_id' => $writing->id])->assertOk();

    expect(mcpPromptText($response))->toContain('My own visible idea')->not->toContain('Hidden thoughts XYZ');

    $anonymous = Retro::factory()->anonymous()->inPhase(RetroPhase::Discussing)->create(['team_id' => $writing->team_id]);
    Participant::factory()->create(['retro_id' => $anonymous->id, 'user_id' => $user->id]);
    $theirs = Participant::factory()->create(['retro_id' => $anonymous->id, 'user_id' => $other->user_id]);
    Card::factory()->create(['retro_id' => $anonymous->id, 'participant_id' => $theirs->id, 'content' => 'Anonymous idea']);

    $data = mcpPromptData(actingAsMcp($user)->prompt(AnalyzeRetro::class, ['board_id' => $anonymous->id])->assertOk());
    $messages = collect($data['messages']['columns'] ?? [])->flatMap(fn (array $column): array => $column['messages']);
    $anonymousCard = $messages->firstWhere('content', 'Anonymous idea');

    expect($anonymousCard)->not->toBeNull()
        ->and($anonymousCard['author'] ?? null)->toBeNull();
});

it('omits insights when no provider is configured', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Discussing)->create();
    [$user] = retroMember($retro);
    RetroTheme::factory()->create(['retro_id' => $retro->id, 'name' => 'Release pain']);

    $withoutProvider = mcpPromptData(actingAsMcp($user)->prompt(AnalyzeRetro::class, ['board_id' => $retro->id])->assertOk());

    expect($withoutProvider)->not->toHaveKey('insights');

    configureLlm();

    $withProvider = mcpPromptData(actingAsMcp($user)->prompt(AnalyzeRetro::class, ['board_id' => $retro->id])->assertOk());

    expect($withProvider)->toHaveKey('insights');
});

it('caps prompt content', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Discussing)->create(['hide_vote_counts' => false]);
    [$user, $participant] = retroMember($retro);

    $cards = collect(range(1, 300))->map(fn (int $index): Card => Card::factory()->create([
        'retro_id' => $retro->id,
        'participant_id' => $participant->id,
        'content' => "Card {$index} ".str_repeat('x', 480),
        'position' => $index,
    ]));

    Vote::factory()->count(5)->create(['retro_id' => $retro->id, 'card_id' => $cards[299]->id]);

    $response = actingAsMcp($user)->prompt(AnalyzeRetro::class, ['board_id' => $retro->id])->assertOk();
    $data = mcpPromptData($response);
    $encoded = json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

    expect(mb_strlen($encoded))->toBeLessThanOrEqual(SkrumPrompt::MaxContentLength)
        ->and($encoded)->toContain('Card 300 ')
        ->and(mcpPromptText($response))->toContain('were left out to fit the size limit');
});

it('describes the team health over the last completed boards', function () {
    $team = Team::factory()->create(['name' => 'Platform']);
    $user = teamMember($team);

    foreach (range(1, 7) as $index) {
        $retro = Retro::factory()->inPhase(RetroPhase::Completed)->create([
            'team_id' => $team->id,
            'title' => "Retro {$index}",
            'created_at' => now()->subWeeks(8 - $index),
            'completed_at' => now()->subWeeks(8 - $index)->addDay(),
        ]);
        RotiVote::factory()->create(['retro_id' => $retro->id, 'score' => 4]);
    }

    $data = mcpPromptData(actingAsMcp($user)->prompt(TeamHealth::class, ['team_id' => $team->id])->assertOk());

    expect($data['team']['name'])->toBe('Platform')
        ->and(collect($data['boards'])->pluck('board.title')->all())->toBe(['Retro 2', 'Retro 3', 'Retro 4', 'Retro 5', 'Retro 6', 'Retro 7']);
});

function standaloneHealthCheck(Team $team, string $title, string $closedAt, int $score): TeamSurvey
{
    $survey = TeamSurvey::factory()->healthCheck()->closed()->create(['team_id' => $team->id, 'title' => $title, 'closed_at' => $closedAt]);
    [, $respondent] = surveyMember($survey);
    answerSurveyQuestion(surveyQuestion($survey, attributes: ['match_key' => 'vision', 'scale_max' => 5]), $respondent, $score);

    return $survey;
}

it('gives the health trend of the team when its newest board ran no health check', function () {
    $team = Team::factory()->create();
    $user = teamMember($team);
    standaloneHealthCheck($team, 'Health check — August', '2026-08-01 10:00:00', 2);
    Retro::factory()->for($team)->inPhase(RetroPhase::Completed)->create(['title' => 'Sprint 9', 'completed_at' => '2026-09-01 10:00:00']);
    standaloneHealthCheck($team, 'Health check — September', '2026-09-15 10:00:00', 4);

    $data = mcpPromptData(actingAsMcp($user)->prompt(TeamHealth::class, ['team_id' => $team->id])->assertOk());

    expect(collect($data['healthTrend'])->pluck('title')->all())->toBe(['Health check — August', 'Health check — September'])
        ->and(collect($data['healthTrend'])->pluck('score')->all())->toEqual([2, 4])
        ->and($data['healthTrend'][0]['boardId'])->toBeNull();
});

it('gives the health trend of a team that ran its health checks without any retrospective', function () {
    $team = Team::factory()->create();
    $user = teamMember($team);
    standaloneHealthCheck($team, 'Health check — September', '2026-09-15 10:00:00', 3);

    $data = mcpPromptData(actingAsMcp($user)->prompt(TeamHealth::class, ['team_id' => $team->id])->assertOk());

    expect($data['boards'])->toBe([])
        ->and(collect($data['healthTrend'])->pluck('title')->all())->toBe(['Health check — September']);
});

it('counts every open agreement of a team, however many there are', function () {
    $team = Team::factory()->create();
    $user = teamMember($team);
    collect(range(1, 1001))
        ->map(fn (): array => [
            ...ActionItem::factory()->withoutRetro($team, $user)->raw(),
            'id' => (string) Str::uuid(),
            'sort_rank' => ActionItem::sortRankFor(false, null, ActionItemPriority::Medium),
            'created_at' => now(),
            'updated_at' => now(),
        ])
        ->chunk(250)
        ->each(fn (Collection $rows) => ActionItem::query()->insert($rows->values()->all()));

    $data = mcpPromptData(actingAsMcp($user)->prompt(TeamHealth::class, ['team_id' => $team->id])->assertOk());

    expect($data['openAgreements'])->toBe(1001);
});

it('takes the ROTI trend from the newest board that has a ROTI', function () {
    $team = Team::factory()->create();
    $user = teamMember($team);
    $rated = Retro::factory()->for($team)->inPhase(RetroPhase::Completed)->create(['title' => 'Rated', 'completed_at' => now()->subWeeks(2)]);
    RotiVote::factory()->create(['retro_id' => $rated->id, 'score' => 4]);
    Retro::factory()->for($team)->inPhase(RetroPhase::Completed)->create(['title' => 'Unrated', 'completed_at' => now()->subWeek()]);

    $data = mcpPromptData(actingAsMcp($user)->prompt(TeamHealth::class, ['team_id' => $team->id])->assertOk());

    expect(collect($data['rotiTrend'])->pluck('title')->all())->toBe(['Rated'])
        ->and($data['rotiTrend'][0]['average'])->toEqual(4);
});

it('reports a team without completed boards', function () {
    $team = Team::factory()->create();
    $user = teamMember($team);

    $response = actingAsMcp($user)->prompt(TeamHealth::class, ['team_id' => $team->id])->assertOk();

    expect(mcpPromptData($response)['boards'])->toBe([])
        ->and(mcpPromptText($response))->toContain('health check not run yet');
});

it('refuses teams outside the grant', function () {
    $team = Team::factory()->create();
    $other = Team::factory()->create(['workspace_id' => $team->workspace_id]);
    $user = teamMember($team);
    $other->members()->attach($user);

    actingAsMcp($user)->prompt(TeamHealth::class, ['team_id' => Team::factory()->create()->id])->assertHasErrors(['Not found.']);
    actingAsMcp($user, [McpScope::Read], $team)->prompt(TeamHealth::class, ['team_id' => $other->id])->assertHasErrors(['Not found.']);
});

it('answers in the user language and never calls an LLM', function () {
    Http::fake();
    configureLlm();

    $retro = Retro::factory()->inPhase(RetroPhase::Discussing)->create();
    [$user] = retroMember($retro);
    $user->update(['locale' => 'fr']);

    $text = mcpPromptText(actingAsMcp($user)->prompt(AnalyzeRetro::class, ['board_id' => $retro->id])->assertOk());

    expect($text)->toContain('Answer in French');
    Http::assertNothingSent();
});

it('turns an unexpected prompt failure into a translated error without logging its message', function () {
    Log::spy();
    $retro = Retro::factory()->create();
    [$user] = retroMember($retro);
    Card::factory()->create(['retro_id' => $retro->id, 'content' => 'secret-card-text']);

    $this->mock(McpContext::class)->shouldReceive('retro')->andThrow(new RuntimeException('secret-card-text'));

    actingAsMcp($user)->prompt(AnalyzeRetro::class, ['board_id' => $retro->id])->assertHasErrors(['Something went wrong.']);

    Log::shouldHaveReceived('error')->once()->withArgs(
        fn (string $message, array $context): bool => ! str_contains(json_encode([$message, $context]), 'secret-card-text')
            && $context['exception'] === RuntimeException::class,
    );
});

it('drops the last messages of the board order when vote totals are hidden', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Voting)->create(['hide_vote_counts' => true]);
    [$user, $participant] = retroMember($retro);
    $column = Column::factory()->create(['retro_id' => $retro->id]);

    foreach (range(1, 300) as $index) {
        Card::factory()->create([
            'retro_id' => $retro->id,
            'column_id' => $column->id,
            'participant_id' => $participant->id,
            'content' => "Card {$index} ".str_repeat('x', 480),
            'position' => $index,
        ]);
    }

    $response = actingAsMcp($user)->prompt(AnalyzeRetro::class, ['board_id' => $retro->id])->assertOk();
    $text = mcpPromptText($response);

    expect($text)->toContain('messages were left out to fit the size limit')
        ->not->toContain('lowest-voted')
        ->and(json_encode(mcpPromptData($response)))->toContain('Card 1 ')->not->toContain('Card 300 ');
});

it('lists the most voted messages when insights are not available', function () {
    $team = Team::factory()->create();
    $user = teamMember($team);
    $retro = Retro::factory()->for($team)->inPhase(RetroPhase::Completed)->create(['completed_at' => now()]);
    $quiet = Card::factory()->create(['retro_id' => $retro->id, 'content' => 'Quiet remark']);
    $popular = Card::factory()->create(['retro_id' => $retro->id, 'content' => 'Popular remark']);
    Vote::factory()->count(3)->create(['retro_id' => $retro->id, 'card_id' => $popular->id]);
    Vote::factory()->create(['retro_id' => $retro->id, 'card_id' => $quiet->id]);

    $board = mcpPromptData(actingAsMcp($user)->prompt(TeamHealth::class, ['team_id' => $team->id])->assertOk())['boards'][0];

    expect($board)->not->toHaveKey('themes')
        ->and($board['topMessages'])->toBe([
            ['content' => 'Popular remark', 'votes' => 3],
            ['content' => 'Quiet remark', 'votes' => 1],
        ]);
});

it('picks the last six completed boards by completion date', function () {
    $team = Team::factory()->create();
    $user = teamMember($team);

    foreach (range(1, 7) as $index) {
        Retro::factory()->inPhase(RetroPhase::Completed)->create([
            'team_id' => $team->id,
            'title' => "Retro {$index}",
            'created_at' => now()->subWeeks(20 - $index),
            'completed_at' => now()->subWeeks($index),
        ]);
    }

    $data = mcpPromptData(actingAsMcp($user)->prompt(TeamHealth::class, ['team_id' => $team->id])->assertOk());

    expect(collect($data['boards'])->pluck('board.title')->all())->toBe(['Retro 6', 'Retro 5', 'Retro 4', 'Retro 3', 'Retro 2', 'Retro 1']);
});

it('never picks a completed board without a completion date as the newest', function () {
    $team = Team::factory()->create();
    $user = teamMember($team);
    Retro::factory()->for($team)->inPhase(RetroPhase::Completed)->create(['title' => 'Dated', 'completed_at' => now()->subWeek()]);
    Retro::factory()->for($team)->inPhase(RetroPhase::Completed)->create(['title' => 'Undated', 'completed_at' => null]);

    $data = mcpPromptData(actingAsMcp($user)->prompt(TeamHealth::class, ['team_id' => $team->id])->assertOk());

    expect(collect($data['boards'])->pluck('board.title')->all())->toBe(['Dated']);
});

it('keeps the team health prompt under the cap by emptying recurring themes', function () {
    configureLlm();
    $team = Team::factory()->create();
    $user = teamMember($team);

    foreach (range(1, 6) as $index) {
        $retro = Retro::factory()->for($team)->inPhase(RetroPhase::Completed)->create(['completed_at' => now()->subWeeks(7 - $index)]);

        RetroTheme::factory()->count(200)->sequence(fn ($sequence): array => ['name' => "T{$sequence->index} ".str_repeat('y', 70)])->create(['retro_id' => $retro->id]);
    }

    $response = actingAsMcp($user)->prompt(TeamHealth::class, ['team_id' => $team->id])->assertOk();
    $data = mcpPromptData($response);

    expect(mb_strlen(json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)))->toBeLessThanOrEqual(SkrumPrompt::MaxContentLength)
        ->and($data['boards'][0]['themes'])->toBe([])
        ->and(mcpPromptText($response))->toContain("Older boards' recurring topics were left out to fit the size limit.");
});

it('drops the oldest boards entirely when emptied themes are not enough', function () {
    $data = ['boards' => collect(range(1, 6))->map(fn (int $index): array => [
        'board' => ['title' => "Retro {$index}"],
        'themes' => ['x'],
        'health' => ['blob' => str_repeat('z', 25000)],
    ])->all()];

    [$fitted, $trimmedThemes, $droppedBoards] = (fn (): array => $this->fit($data))->call(resolve(TeamHealth::class));

    expect(mb_strlen(json_encode($fitted, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)))->toBeLessThanOrEqual(SkrumPrompt::MaxContentLength)
        ->and($trimmedThemes)->toBeTrue()
        ->and($droppedBoards)->toBe(4)
        ->and(collect($fitted['boards'])->pluck('board.title')->all())->toBe(['Retro 5', 'Retro 6']);
});
