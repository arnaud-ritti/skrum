<?php

use App\Actions\Retros\ClearRetroInsights;
use App\Enums\CardSentiment;
use App\Enums\RetroPhase;
use App\Enums\SuggestedActionStatus;
use App\Enums\SummaryStatus;
use App\Events\Retros\InsightsChanged;
use App\Events\Retros\ResultsChanged;
use App\Exceptions\Llm\InvalidLlmOutput;
use App\Exceptions\Llm\LlmUnavailable;
use App\Jobs\GenerateRetroSummary;
use App\Models\Card;
use App\Models\Retro;
use App\Models\RetroTheme;
use App\Models\SuggestedAction;
use Illuminate\Contracts\Queue\ShouldBeUnique;
use Illuminate\Contracts\Queue\ShouldBeUniqueUntilProcessing;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Queue;

beforeEach(function () {
    Event::fake();
});

function summarisedRetro(array $attributes = []): array
{
    $retro = Retro::factory()->inPhase(RetroPhase::Completed)->create([
        'ai_summary_enabled' => true,
        'summary_status' => SummaryStatus::Pending,
        'summary_requested_at' => now(),
        ...$attributes,
    ]);
    $first = Card::factory()->create(['retro_id' => $retro->id, 'content' => 'Deploys are slow', 'position' => 0]);
    $second = Card::factory()->create(['retro_id' => $retro->id, 'content' => 'Great pairing', 'position' => 1]);

    return [$retro, $first, $second];
}

function summaryReply(array $overrides = []): array
{
    return [
        'summary' => 'The team shipped but releases hurt.',
        'themes' => [['name' => 'Release pain', 'cardIds' => [1]]],
        'suggestedActions' => [['content' => 'Automate releases', 'theme' => 'Release pain'], ['content' => 'Keep pairing']],
        'cardInsights' => [
            ['cardId' => 1, 'sentiment' => 'negative', 'category' => 'Tooling'],
            ['cardId' => 2, 'sentiment' => 'positive', 'category' => 'Collaboration'],
        ],
        ...$overrides,
    ];
}

function runSummaryJob(Retro $retro): void
{
    app()->call([new GenerateRetroSummary($retro->id), 'handle']);
}

it('queues the summary when a retro with the summary on is completed', function () {
    Queue::fake();
    configureLlm();
    $retro = Retro::factory()->inPhase(RetroPhase::Roti)->create(['ai_summary_enabled' => true]);
    [$user] = retroFacilitator($retro);

    $this->actingAs($user)->putJson(route('retros.phase.update', $retro), ['phase' => 'completed'])->assertOk();

    Queue::assertPushed(GenerateRetroSummary::class, fn (GenerateRetroSummary $job) => $job->retroId === $retro->id);
    expect($retro->fresh()->summary_status)->toBe(SummaryStatus::Pending);
    Event::assertDispatched(ResultsChanged::class);
});

it('does not queue the summary when opted out, without provider or on other phase changes', function (bool $optedIn, bool $configured, RetroPhase $from, string $to) {
    Queue::fake();

    if ($configured) {
        configureLlm();
    }

    $retro = Retro::factory()->inPhase($from)->create(['ai_summary_enabled' => $optedIn]);
    [$user] = retroFacilitator($retro);

    $this->actingAs($user)->putJson(route('retros.phase.update', $retro), ['phase' => $to])->assertOk();

    Queue::assertNothingPushed();
    expect($retro->fresh()->summary_status)->toBeNull();
})->with([
    'opted out' => [false, true, RetroPhase::Roti, 'completed'],
    'no provider' => [true, false, RetroPhase::Roti, 'completed'],
    'not completing' => [true, true, RetroPhase::Voting, 'discussing'],
]);

it('is unique per retro and retried with backoff', function () {
    $job = new GenerateRetroSummary('retro-id');

    expect($job)->toBeInstanceOf(ShouldBeUniqueUntilProcessing::class)
        ->and($job)->toBeInstanceOf(ShouldBeUnique::class)
        ->and($job->uniqueId())->toBe('retro-id')
        ->and($job->tries)->toBe(3)
        ->and($job->backoff())->toBe([10, 60]);
});

it('stores the summary, themes, suggestions and card insights', function () {
    configureLlm();
    fakeLlmReply(summaryReply());
    [$retro, $first, $second] = summarisedRetro();

    runSummaryJob($retro);

    $retro->refresh();
    $theme = $retro->themes()->with('cards')->sole();

    expect($retro->summary)->toBe('The team shipped but releases hurt.')
        ->and($retro->summary_status)->toBe(SummaryStatus::Ready)
        ->and($retro->summary_generated_at)->not->toBeNull()
        ->and($theme->name)->toBe('Release pain')
        ->and($theme->cards->pluck('id')->all())->toBe([$first->id])
        ->and($retro->suggestedActions()->get()->map->only(['content', 'theme_id', 'status'])->all())->toBe([
            ['content' => 'Automate releases', 'theme_id' => $theme->id, 'status' => SuggestedActionStatus::Pending],
            ['content' => 'Keep pairing', 'theme_id' => null, 'status' => SuggestedActionStatus::Pending],
        ])
        ->and($first->fresh()->only(['sentiment', 'category']))->toBe(['sentiment' => CardSentiment::Negative, 'category' => 'Tooling'])
        ->and($second->fresh()->sentiment)->toBe(CardSentiment::Positive);
    Event::assertDispatched(ResultsChanged::class);
    Event::assertDispatched(fn (InsightsChanged $event) => $event->broadcastWith() === []);
});

it('sends no participant data and only revealed content', function () {
    configureLlm();
    fakeLlmReply(summaryReply());
    [$retro, $first] = summarisedRetro(['is_anonymous' => true]);

    runSummaryJob($retro);

    expect(llmRequestBodies())
        ->toContain('Deploys are slow')
        ->not->toContain($first->participant_id)
        ->not->toContain($first->participant->displayName())
        ->not->toContain($first->id)
        ->not->toContain('llm-secret-key');
});

it('replaces pending suggestions and insights but keeps handled ones', function () {
    configureLlm();
    [$retro, $first, $second] = summarisedRetro();
    $oldTheme = RetroTheme::factory()->create(['retro_id' => $retro->id, 'name' => 'Old theme']);
    SuggestedAction::factory()->create(['retro_id' => $retro->id, 'content' => 'Old pending']);
    $promoted = SuggestedAction::factory()->create(['retro_id' => $retro->id, 'content' => 'Automate releases', 'status' => SuggestedActionStatus::Promoted]);
    $rejected = SuggestedAction::factory()->rejected()->create(['retro_id' => $retro->id, 'content' => 'Drop standups']);
    $second->forceFill(['sentiment' => CardSentiment::Negative, 'category' => 'Old'])->save();
    fakeLlmReply(summaryReply([
        'suggestedActions' => [['content' => ' automate RELEASES '], ['content' => 'Drop standups'], ['content' => 'New step']],
        'cardInsights' => [['cardId' => 1, 'sentiment' => 'neutral', 'category' => 'Tooling']],
    ]));

    runSummaryJob($retro);

    expect(RetroTheme::find($oldTheme->id))->toBeNull()
        ->and($retro->suggestedActions()->pluck('content')->sort()->values()->all())->toBe(['Automate releases', 'Drop standups', 'New step'])
        ->and($promoted->fresh()->status)->toBe(SuggestedActionStatus::Promoted)
        ->and($rejected->fresh()->status)->toBe(SuggestedActionStatus::Rejected)
        ->and($second->fresh()->only(['sentiment', 'category']))->toBe(['sentiment' => null, 'category' => null]);
});

it('aborts without calling the provider when the retro was reopened', function () {
    configureLlm();
    fakeLlmReply(summaryReply());
    [$retro] = summarisedRetro(['phase' => RetroPhase::Discussing]);

    runSummaryJob($retro);

    Http::assertNothingSent();
    expect($retro->fresh()->summary_status)->toBeNull();
    Event::assertDispatched(ResultsChanged::class);
});

it('aborts without calling the provider once the provider is removed', function () {
    fakeLlmReply(summaryReply());
    [$retro] = summarisedRetro();

    runSummaryJob($retro);

    Http::assertNothingSent();
    expect($retro->fresh()->summary_status)->toBeNull();
    Event::assertDispatched(ResultsChanged::class);
});

it('lets the queue retry provider errors and unusable answers', function (string $reply, string $exception) {
    configureLlm();
    $reply === 'provider error' ? fakeLlmFailure() : fakeLlmReply(['themes' => []]);
    [$retro] = summarisedRetro();

    expect(fn () => runSummaryJob($retro))->toThrow($exception)
        ->and($retro->fresh()->summary_status)->toBe(SummaryStatus::Pending);
})->with([
    'provider error' => ['provider error', LlmUnavailable::class],
    'no summary' => ['no summary', InvalidLlmOutput::class],
]);

it('bounds the job runtime below the queue retry window', function () {
    $job = new GenerateRetroSummary('retro-id');

    expect($job->timeout)->toBe(75)
        ->and($job->uniqueFor)->toBe(540);
});

it('removes everything a summary deletion clears', function () {
    [$retro, $first] = summarisedRetro(['summary' => 'Old summary', 'summary_status' => SummaryStatus::Ready]);
    RetroTheme::factory()->create(['retro_id' => $retro->id]);
    SuggestedAction::factory()->create(['retro_id' => $retro->id]);
    $first->forceFill(['sentiment' => CardSentiment::Positive, 'category' => 'Tooling'])->save();

    resolve(ClearRetroInsights::class)->remove($retro);

    $retro->refresh();

    expect($retro->summary)->toBeNull()
        ->and($retro->summary_status)->toBeNull()
        ->and($retro->themes()->count())->toBe(0)
        ->and($retro->suggestedActions()->count())->toBe(0)
        ->and($first->fresh()->category)->toBeNull();
});

it('marks the summary failed and clears insights after the last attempt', function () {
    [$retro, $first] = summarisedRetro(['summary' => 'Old summary']);
    RetroTheme::factory()->create(['retro_id' => $retro->id]);
    SuggestedAction::factory()->create(['retro_id' => $retro->id]);
    $handled = SuggestedAction::factory()->rejected()->create(['retro_id' => $retro->id]);
    $first->forceFill(['sentiment' => CardSentiment::Positive, 'category' => 'Tooling'])->save();

    (new GenerateRetroSummary($retro->id))->failed(new LlmUnavailable);

    $retro->refresh();

    expect($retro->summary_status)->toBe(SummaryStatus::Failed)
        ->and($retro->summary)->toBeNull()
        ->and($retro->themes()->count())->toBe(0)
        ->and($retro->suggestedActions()->pluck('id')->all())->toBe([$handled->id])
        ->and($first->fresh()->sentiment)->toBeNull();
    Event::assertDispatched(ResultsChanged::class);
    Event::assertDispatched(InsightsChanged::class);
});

it('does not mark the summary failed when the retro was reopened meanwhile', function () {
    [$retro] = summarisedRetro(['phase' => RetroPhase::Discussing, 'summary_status' => SummaryStatus::Pending]);

    (new GenerateRetroSummary($retro->id))->failed(new LlmUnavailable);

    expect($retro->fresh()->summary_status)->toBeNull();
    Event::assertDispatched(ResultsChanged::class);
});

it('sends nothing when the retro is reopened, opted out and completed again before the job runs', function () {
    Queue::fake();
    configureLlm();
    fakeLlmReply(summaryReply());
    $retro = Retro::factory()->inPhase(RetroPhase::Roti)->create(['ai_summary_enabled' => true]);
    [$user] = retroFacilitator($retro);

    $this->actingAs($user)->putJson(route('retros.phase.update', $retro), ['phase' => 'completed'])->assertOk();
    $this->actingAs($user)->putJson(route('retros.phase.update', $retro), ['phase' => 'roti'])->assertOk();
    $this->actingAs($user)->patchJson(route('retros.settings.update', $retro), ['ai_summary_enabled' => false])->assertNoContent();
    $this->actingAs($user)->putJson(route('retros.phase.update', $retro), ['phase' => 'completed'])->assertOk();

    Queue::assertPushed(GenerateRetroSummary::class, 1);

    runSummaryJob($retro);

    Http::assertNothingSent();
    expect($retro->fresh()->summary_status)->toBeNull();
});

it('sends nothing when the summary is deleted before the job runs', function () {
    Queue::fake();
    configureLlm();
    fakeLlmReply(summaryReply());
    [$retro] = summarisedRetro();
    [$user] = retroFacilitator($retro);

    $this->actingAs($user)->deleteJson(route('retros.summary.destroy', $retro))->assertNoContent();

    runSummaryJob($retro);

    Http::assertNothingSent();
    expect($retro->fresh()->summary_status)->toBeNull();
});

it('keeps a newer summary when a stale attempt fails late', function () {
    [$retro] = summarisedRetro(['summary' => 'Newer summary', 'summary_status' => SummaryStatus::Ready, 'summary_generated_at' => now()]);
    $theme = RetroTheme::factory()->create(['retro_id' => $retro->id]);

    (new GenerateRetroSummary($retro->id))->failed(new LlmUnavailable);

    $retro->refresh();

    expect($retro->summary_status)->toBe(SummaryStatus::Ready)
        ->and($retro->summary)->toBe('Newer summary')
        ->and(RetroTheme::find($theme->id))->not->toBeNull();
    Event::assertNotDispatched(InsightsChanged::class);
});

it('does not mark a deliberately deleted summary as failed', function () {
    [$retro] = summarisedRetro(['summary_status' => null, 'summary_requested_at' => null]);

    (new GenerateRetroSummary($retro->id))->failed(new LlmUnavailable);

    expect($retro->fresh()->summary_status)->toBeNull();
    Event::assertNotDispatched(ResultsChanged::class);
});
