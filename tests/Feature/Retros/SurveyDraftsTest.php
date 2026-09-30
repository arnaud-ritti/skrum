<?php

use App\Enums\RetroPhase;
use App\Models\Retro;
use App\Models\Survey;

function draftingRetro(RetroPhase $phase = RetroPhase::Writing, array $attributes = []): array
{
    $retro = Retro::factory()->inPhase($phase)->create(['title' => 'Sprint 12', ...$attributes]);
    [$user] = retroFacilitator($retro);

    return [$retro, $user];
}

it('drafts a survey without saving it', function () {
    configureLlm();
    fakeLlmReply(['question' => 'How was the pace?', 'description' => null, 'options' => ['Too slow', 'Right', 'Too fast']]);
    [$retro, $user] = draftingRetro();

    $response = $this->actingAs($user)
        ->postJson(route('retros.survey-drafts.store', $retro), ['prompt' => 'ask about the sprint pace'])
        ->assertOk()
        ->assertExactJson(['question' => 'How was the pace?', 'description' => null, 'options' => ['Too slow', 'Right', 'Too fast']]);

    expect(Survey::count())->toBe(0)
        ->and($response->getContent())->not->toContain('llm-secret-key')
        ->and(llmRequestBodies())->toContain('ask about the sprint pace')->toContain('Sprint 12')->toContain('single');
});

it('drops options for free-text drafts', function () {
    configureLlm();
    fakeLlmReply(['question' => 'What should we try next?', 'options' => ['a', 'b']]);
    [$retro, $user] = draftingRetro();

    $this->actingAs($user)
        ->postJson(route('retros.survey-drafts.store', $retro), ['prompt' => 'open question', 'kind' => 'text'])
        ->assertOk()
        ->assertJsonPath('options', []);
});

it('refuses drafts that break the survey limits', function (array|string $reply) {
    configureLlm();
    fakeLlmReply($reply);
    [$retro, $user] = draftingRetro();

    $this->actingAs($user)
        ->postJson(route('retros.survey-drafts.store', $retro), ['prompt' => 'anything'])
        ->assertStatus(502)
        ->assertJsonPath('message', 'Could not generate a survey. Try again or write it yourself.');
})->with([
    'not json' => ['I cannot help with that'],
    'eleven options' => [['question' => 'Q?', 'options' => array_map(fn (int $i) => "Option {$i}", range(1, 11))]],
    'one option' => [['question' => 'Q?', 'options' => ['Only']]],
    'long question' => [['question' => str_repeat('a', 201), 'options' => ['a', 'b']]],
    'empty option' => [['question' => 'Q?', 'options' => ['a', ' ']]],
]);

it('reports an unavailable provider', function () {
    configureLlm();
    fakeLlmFailure();
    [$retro, $user] = draftingRetro();

    $this->actingAs($user)
        ->postJson(route('retros.survey-drafts.store', $retro), ['prompt' => 'anything'])
        ->assertStatus(502)
        ->assertJsonPath('message', 'The text generator is unavailable. Try again later.');
});

it('hides drafts without a provider and keeps them to the facilitator', function () {
    [$retro, $facilitator] = draftingRetro();
    [$member] = retroMember($retro);

    $this->actingAs($facilitator)->postJson(route('retros.survey-drafts.store', $retro), ['prompt' => 'x'])->assertNotFound();

    configureLlm();

    $this->actingAs($member)->postJson(route('retros.survey-drafts.store', $retro), ['prompt' => 'x'])->assertForbidden();
});

it('follows the survey creation phases and lock', function (RetroPhase $phase, array $attributes, int $status) {
    configureLlm();
    fakeLlmReply(['question' => 'Q?', 'options' => ['a', 'b']]);
    [$retro, $user] = draftingRetro($phase, $attributes);

    $this->actingAs($user)->postJson(route('retros.survey-drafts.store', $retro), ['prompt' => 'x'])->assertStatus($status);
})->with([
    'discussing' => [RetroPhase::Discussing, [], 200],
    'completed' => [RetroPhase::Completed, [], 403],
    'health check' => [RetroPhase::HealthCheck, ['health_check_enabled' => true], 403],
    'locked' => [RetroPhase::Voting, ['is_locked' => true], 423],
]);

it('validates the prompt and rate limits drafts per participant', function () {
    configureLlm();
    fakeLlmReply(['question' => 'Q?', 'options' => ['a', 'b']]);
    [$retro, $user] = draftingRetro();
    $route = route('retros.survey-drafts.store', $retro);

    $this->actingAs($user)->postJson($route, ['prompt' => str_repeat('a', 301)])->assertJsonValidationErrors('prompt');

    foreach (range(1, 10) as $attempt) {
        $this->actingAs($user)->postJson($route, ['prompt' => 'x'])->assertOk();
    }

    $this->actingAs($user)->postJson($route, ['prompt' => 'x'])->assertTooManyRequests();
});
