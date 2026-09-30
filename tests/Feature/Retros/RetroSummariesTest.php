<?php

use App\Enums\CardSentiment;
use App\Enums\RetroPhase;
use App\Enums\SummaryStatus;
use App\Events\Retros\InsightsChanged;
use App\Events\Retros\ResultsChanged;
use App\Jobs\GenerateRetroSummary;
use App\Models\Card;
use App\Models\Retro;
use App\Models\RetroTheme;
use App\Models\SuggestedAction;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Queue;

beforeEach(function () {
    Event::fake();
    Queue::fake();
    configureLlm();
});

function completedForSummary(array $attributes = []): array
{
    $retro = Retro::factory()->inPhase(RetroPhase::Completed)->create($attributes);
    [$user] = retroFacilitator($retro);

    return [$retro, $user];
}

it('queues a summary on demand even when the retro opted out', function () {
    [$retro, $user] = completedForSummary(['ai_summary_enabled' => false]);

    $this->actingAs($user)->postJson(route('retros.summary.store', $retro))
        ->assertAccepted()
        ->assertExactJson(['status' => 'pending']);

    Queue::assertPushed(GenerateRetroSummary::class, 1);
    expect($retro->fresh()->summary_status)->toBe(SummaryStatus::Pending);
    Event::assertDispatched(ResultsChanged::class);
});

it('does not queue a second job while one is pending', function () {
    [$retro, $user] = completedForSummary(['summary_status' => SummaryStatus::Pending, 'summary_requested_at' => now()]);

    $this->actingAs($user)->postJson(route('retros.summary.store', $retro))->assertAccepted()->assertExactJson(['status' => 'pending']);

    Queue::assertNothingPushed();
});

it('treats a pending summary older than ten minutes as failed and re-queues it', function () {
    [$retro, $user] = completedForSummary(['summary_status' => SummaryStatus::Pending, 'summary_requested_at' => now()->subMinutes(11)]);

    $this->actingAs($user)->postJson(route('retros.summary.store', $retro))->assertAccepted();

    Queue::assertPushed(GenerateRetroSummary::class, 1);
    expect($retro->fresh()->summary_requested_at->isAfter(now()->subMinute()))->toBeTrue();
});

it('retries a failed summary', function () {
    [$retro, $user] = completedForSummary(['summary_status' => SummaryStatus::Failed]);

    $this->actingAs($user)->postJson(route('retros.summary.store', $retro))->assertAccepted();

    Queue::assertPushed(GenerateRetroSummary::class, 1);
});

it('removes the summary and insights but keeps handled suggestions', function () {
    [$retro, $user] = completedForSummary(['summary' => 'Text', 'summary_status' => SummaryStatus::Ready, 'summary_generated_at' => now(), 'ai_summary_enabled' => true]);
    RetroTheme::factory()->create(['retro_id' => $retro->id]);
    SuggestedAction::factory()->create(['retro_id' => $retro->id]);
    $handled = SuggestedAction::factory()->rejected()->create(['retro_id' => $retro->id]);
    $card = Card::factory()->create(['retro_id' => $retro->id]);
    $card->forceFill(['sentiment' => CardSentiment::Positive, 'category' => 'Tooling'])->save();

    $this->actingAs($user)->deleteJson(route('retros.summary.destroy', $retro))->assertNoContent();

    $retro->refresh();

    expect($retro->only(['summary', 'summary_generated_at', 'summary_status', 'ai_summary_enabled']))->toBe([
        'summary' => null,
        'summary_generated_at' => null,
        'summary_status' => null,
        'ai_summary_enabled' => true,
    ])
        ->and($retro->themes()->count())->toBe(0)
        ->and($retro->suggestedActions()->pluck('id')->all())->toBe([$handled->id])
        ->and($card->fresh()->only(['sentiment', 'category']))->toBe(['sentiment' => null, 'category' => null]);
    Event::assertDispatched(ResultsChanged::class);
    Event::assertDispatched(InsightsChanged::class);
});

it('keeps summary actions to the facilitator of a completed retro with a provider', function () {
    [$retro, $facilitator] = completedForSummary();
    [$member] = retroMember($retro);

    $this->actingAs($member)->postJson(route('retros.summary.store', $retro))->assertForbidden();
    $this->actingAs($member)->deleteJson(route('retros.summary.destroy', $retro))->assertForbidden();

    $retro->update(['phase' => RetroPhase::Discussing]);

    $this->actingAs($facilitator)->postJson(route('retros.summary.store', $retro))->assertForbidden();

    $retro->update(['phase' => RetroPhase::Completed]);
    config(['services.llm.key' => null]);

    $this->actingAs($facilitator)->postJson(route('retros.summary.store', $retro))->assertNotFound();
    $this->actingAs($facilitator)->deleteJson(route('retros.summary.destroy', $retro))->assertNotFound();
});

it('rate limits summary requests per retro', function () {
    [$retro, $user] = completedForSummary();

    foreach (range(1, 5) as $attempt) {
        $this->actingAs($user)->postJson(route('retros.summary.store', $retro))->assertAccepted();
    }

    $this->actingAs($user)->postJson(route('retros.summary.store', $retro))->assertTooManyRequests();
});
