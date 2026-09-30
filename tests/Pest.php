<?php

use App\Actions\Retros\GuestCookie;
use App\Enums\WorkspaceRole;
use App\Models\Participant;
use App\Models\Retro;
use App\Models\Survey;
use App\Models\SurveyResponse;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/*
|--------------------------------------------------------------------------
| Test Case
|--------------------------------------------------------------------------
|
| The closure you provide to your test functions is always bound to a specific PHPUnit test
| case class. By default, that class is "PHPUnit\Framework\TestCase". Of course, you may
| need to change it using the "pest()" function to bind different classes or traits.
|
*/

pest()->extend(TestCase::class)
    ->use(RefreshDatabase::class)
    ->in('Feature');

/*
|--------------------------------------------------------------------------
| Expectations
|--------------------------------------------------------------------------
|
| When you're writing tests, you often need to check that values meet certain conditions. The
| "expect()" function gives you access to a set of "expectations" methods that you can use
| to assert different things. Of course, you may extend the Expectation API at any time.
|
*/

expect()->extend('toBeOne', function () {
    return $this->toBe(1);
});

/*
|--------------------------------------------------------------------------
| Functions
|--------------------------------------------------------------------------
|
| While Pest is very powerful out-of-the-box, you may have some testing code specific to your
| project that you don't want to repeat in every file. Here you can also expose helpers as
| global functions to help you to reduce the number of lines of code in your test files.
|
*/

/**
 * @return array{0: User, 1: Participant}
 */
function retroMember(Retro $retro): array
{
    $user = User::factory()->create();
    $retro->team->workspace->members()->attach($user, ['role' => WorkspaceRole::Member->value]);
    $retro->team->members()->attach($user);

    $participant = Participant::factory()->create(['retro_id' => $retro->id, 'user_id' => $user->id]);

    return [$user, $participant];
}

/**
 * @return array{0: User, 1: Participant}
 */
function retroFacilitator(Retro $retro): array
{
    [$user, $participant] = retroMember($retro);

    $retro->forceFill(['facilitator_participant_id' => $participant->id])->save();

    return [$user, $participant];
}

/**
 * @return array<string, string>
 */
function retroGuestCookie(Participant $participant, string $secret = 'secret'): array
{
    return [GuestCookie::name($participant->retro_id) => "{$participant->id}|{$secret}"];
}

function answerSurvey(Survey $survey, Participant $participant, int ...$optionIndexes): void
{
    $options = $survey->options()->get()->values();

    foreach ($optionIndexes as $index) {
        SurveyResponse::factory()->create([
            'survey_id' => $survey->id,
            'survey_option_id' => $options[$index]->id,
            'participant_id' => $participant->id,
        ]);
    }
}
