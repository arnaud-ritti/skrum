<?php

use App\Actions\Integrations\MatchIntegrationUserAccounts;
use App\Enums\IntegrationAccess;
use App\Enums\IntegrationProvider;
use App\Enums\IntegrationUserMatch;
use App\Events\Integrations\IntegrationActivated;
use App\Jobs\MatchIntegrationUsers;
use App\Models\IntegrationUserMapping;
use App\Models\Team;
use App\Models\TeamIntegration;
use App\Models\User;
use Illuminate\Http\Client\Request as HttpClientRequest;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Queue;

beforeEach(function () {
    Http::preventStrayRequests();
    enableIntegrations(IntegrationProvider::Jira, IntegrationProvider::Linear);
});

/**
 * @param  array<string, array<int, array<string, mixed>>>  $directory  search results per email
 */
function fakeJiraDirectory(array $directory): void
{
    Http::fake([jiraApiUrl('rest/api/3/user/search*') => fn (HttpClientRequest $request) => Http::response($directory[$request['query']] ?? [])]);
}

function matchingMember(Team $team, string $email): User
{
    $user = teamMember($team);
    $user->forceFill(['email' => $email])->save();

    return $user;
}

it('starts matching when a write connection becomes active', function () {
    Queue::fake();
    $integration = TeamIntegration::factory()->jira()->create();

    event(new IntegrationActivated($integration, false));

    Queue::assertPushed(MatchIntegrationUsers::class, fn (MatchIntegrationUsers $job) => $job->integrationId === $integration->id);
    expect(MatchIntegrationUsers::isRunning($integration))->toBeTrue();
});

it('maps team members with one active Jira account for their email', function () {
    $integration = TeamIntegration::factory()->jira()->create();
    $ada = matchingMember($integration->team, 'ada@example.com');
    $grace = matchingMember($integration->team, 'grace@example.com');
    fakeJiraDirectory([
        'ada@example.com' => [jiraAccount('acc-ada', 'Ada L.')],
        'grace@example.com' => [jiraAccount('acc-1', 'Grace'), jiraAccount('acc-2', 'Grace H.')],
    ]);

    resolve(MatchIntegrationUserAccounts::class)->handle($integration);

    $mapping = $integration->accountFor($ada);

    expect($mapping?->external_account_id)->toBe('acc-ada')
        ->and($mapping?->external_display_name)->toBe('Ada L.')
        ->and($mapping?->matched_by)->toBe(IntegrationUserMatch::Email)
        ->and($integration->accountFor($grace))->toBeNull();
});

it('looks up current members with a verified email only', function () {
    $integration = TeamIntegration::factory()->jira()->create();
    matchingMember($integration->team, 'ada@example.com');
    $unverified = matchingMember($integration->team, 'late@example.com');
    $unverified->forceFill(['email_verified_at' => null])->save();
    User::factory()->create(['email' => 'outsider@example.com']);
    fakeJiraDirectory([]);

    resolve(MatchIntegrationUserAccounts::class)->handle($integration);

    Http::assertSentCount(1);
    Http::assertSent(fn (HttpClientRequest $request) => $request['query'] === 'ada@example.com');
});

it('never overwrites manual rows', function () {
    $integration = TeamIntegration::factory()->jira()->create();
    $manual = matchingMember($integration->team, 'ada@example.com');
    $never = matchingMember($integration->team, 'grace@example.com');
    IntegrationUserMapping::factory()->manual()->create(['team_integration_id' => $integration->id, 'user_id' => $manual->id, 'external_account_id' => 'acc-chosen']);
    IntegrationUserMapping::factory()->neverAssign()->create(['team_integration_id' => $integration->id, 'user_id' => $never->id]);
    Http::fake([
        jiraApiUrl('rest/api/3/user?accountId=acc-chosen') => Http::response(jiraAccount('acc-chosen', 'Ada (chosen)')),
        jiraApiUrl('rest/api/3/user/search*') => Http::response([jiraAccount('acc-other', 'Someone')]),
    ]);

    resolve(MatchIntegrationUserAccounts::class)->handle($integration);

    expect($integration->accountFor($manual)?->external_account_id)->toBe('acc-chosen')
        ->and($integration->accountFor($never)?->isNeverAssign())->toBeTrue();
    Http::assertNotSent(fn (HttpClientRequest $request) => str_contains($request->url(), 'user/search'));
});

it('re-checks existing rows', function () {
    $integration = TeamIntegration::factory()->jira()->create();
    $stale = matchingMember($integration->team, 'ada@example.com');
    $inactive = matchingMember($integration->team, 'grace@example.com');
    $healthy = matchingMember($integration->team, 'alan@example.com');
    IntegrationUserMapping::factory()->create(['team_integration_id' => $integration->id, 'user_id' => $stale->id, 'external_account_id' => 'acc-gone']);
    IntegrationUserMapping::factory()->manual()->create(['team_integration_id' => $integration->id, 'user_id' => $inactive->id, 'external_account_id' => 'acc-left']);
    IntegrationUserMapping::factory()->manual()->create(['team_integration_id' => $integration->id, 'user_id' => $healthy->id, 'external_account_id' => 'acc-alan', 'account_inactive' => true]);
    Http::fake([
        jiraApiUrl('rest/api/3/user?accountId=acc-gone') => Http::response(['errorMessages' => ['Not found']], 404),
        jiraApiUrl('rest/api/3/user?accountId=acc-left') => Http::response(jiraAccount('acc-left', 'Grace', active: false)),
        jiraApiUrl('rest/api/3/user?accountId=acc-alan') => Http::response(jiraAccount('acc-alan', 'Alan T.')),
        jiraApiUrl('rest/api/3/user/search*') => Http::response([jiraAccount('acc-ada-new', 'Ada')]),
    ]);

    resolve(MatchIntegrationUserAccounts::class)->handle($integration);

    expect($integration->accountFor($stale)?->external_account_id)->toBe('acc-ada-new')
        ->and($integration->accountFor($inactive)?->account_inactive)->toBeTrue()
        ->and($integration->accountFor($inactive)?->external_account_id)->toBe('acc-left')
        ->and($integration->accountFor($healthy)?->account_inactive)->toBeFalse()
        ->and($integration->accountFor($healthy)?->external_display_name)->toBe('Alan T.');
});

it('keeps an admin choice saved while the re-check waits on the provider', function () {
    $integration = TeamIntegration::factory()->jira()->create();
    $excluded = matchingMember($integration->team, 'ada@example.com');
    $chosen = matchingMember($integration->team, 'grace@example.com');
    $excludedRow = IntegrationUserMapping::factory()->create(['team_integration_id' => $integration->id, 'user_id' => $excluded->id, 'external_account_id' => 'acc-gone']);
    $chosenRow = IntegrationUserMapping::factory()->create(['team_integration_id' => $integration->id, 'user_id' => $chosen->id, 'external_account_id' => 'acc-grace']);
    Http::fake([
        jiraApiUrl('rest/api/3/user?accountId=acc-gone') => function () use ($excludedRow) {
            $excludedRow->forceFill(['matched_by' => IntegrationUserMatch::Manual, 'external_account_id' => null, 'external_display_name' => null])->save();

            return Http::response(['errorMessages' => ['Not found']], 404);
        },
        jiraApiUrl('rest/api/3/user?accountId=acc-grace') => function () use ($chosenRow) {
            $chosenRow->forceFill(['matched_by' => IntegrationUserMatch::Manual, 'external_account_id' => 'acc-chosen', 'external_display_name' => 'Grace (chosen)'])->save();

            return Http::response(jiraAccount('acc-grace', 'Grace (old)', active: false));
        },
        jiraApiUrl('rest/api/3/user/search*') => Http::response([jiraAccount('acc-other', 'Someone')]),
    ]);

    resolve(MatchIntegrationUserAccounts::class)->handle($integration);

    expect($integration->accountFor($excluded)?->isNeverAssign())->toBeTrue()
        ->and($integration->accountFor($chosen)?->external_account_id)->toBe('acc-chosen')
        ->and($integration->accountFor($chosen)?->external_display_name)->toBe('Grace (chosen)')
        ->and($integration->accountFor($chosen)?->account_inactive)->toBeFalse();
});

it('keeps a row saved by an admin while matching searches the provider', function () {
    $integration = TeamIntegration::factory()->jira()->create();
    $ada = matchingMember($integration->team, 'ada@example.com');
    Http::fake([jiraApiUrl('rest/api/3/user/search*') => function () use ($integration, $ada) {
        IntegrationUserMapping::factory()->neverAssign()->create(['team_integration_id' => $integration->id, 'user_id' => $ada->id]);

        return Http::response([jiraAccount('acc-ada', 'Ada L.')]);
    }]);

    resolve(MatchIntegrationUserAccounts::class)->handle($integration);

    expect($integration->accountFor($ada)?->isNeverAssign())->toBeTrue();
});

it('matches Linear members on this server', function () {
    $integration = TeamIntegration::factory()->linear()->create();
    $ada = matchingMember($integration->team, 'ada@example.com');
    fakeLinearUserDirectoryGraphql(['users(' => ['users' => [
        'nodes' => [linearAccount('lin-ada', 'Ada Lovelace', 'Ada@Example.com')],
        'pageInfo' => ['hasNextPage' => false, 'endCursor' => null],
    ]]]);

    resolve(MatchIntegrationUserAccounts::class)->handle($integration);

    expect($integration->accountFor($ada)?->external_account_id)->toBe('lin-ada');
    Http::assertNotSent(fn (HttpClientRequest $request) => str_contains($request->body(), 'ada@example.com'));
});

it('does nothing for read-only connections or Jira without account access', function () {
    $read = TeamIntegration::factory()->jira(IntegrationAccess::Read)->create();
    matchingMember($read->team, 'ada@example.com');
    $withoutScope = TeamIntegration::factory()->jira()->create(['scopes' => ['offline_access', 'read:jira-work', 'write:jira-work']]);
    matchingMember($withoutScope->team, 'grace@example.com');

    resolve(MatchIntegrationUserAccounts::class)->handle($read);
    resolve(MatchIntegrationUserAccounts::class)->handle($withoutScope);

    Http::assertNothingSent();
});

it('waits when the provider rate limits and clears the flag when done', function () {
    Queue::fake();
    $integration = TeamIntegration::factory()->jira()->create();
    matchingMember($integration->team, 'ada@example.com');
    Http::fake([jiraApiUrl('rest/api/3/user/search*') => Http::sequence()
        ->push([], 429, ['Retry-After' => '42'])
        ->push([])]);
    MatchIntegrationUsers::start($integration);

    $limited = new MatchIntegrationUsers($integration->id)->withFakeQueueInteractions();
    $limited->handle(resolve(MatchIntegrationUserAccounts::class));

    $limited->assertReleased(42);
    expect(MatchIntegrationUsers::isRunning($integration))->toBeTrue();

    new MatchIntegrationUsers($integration->id)->withFakeQueueInteractions()->handle(resolve(MatchIntegrationUserAccounts::class));

    expect(MatchIntegrationUsers::isRunning($integration))->toBeFalse();
});
