<?php

use App\Enums\ColumnColor;
use App\Enums\RetroPhase;
use App\Models\ActionItem;
use App\Models\Card;
use App\Models\Column;
use App\Models\Participant;
use App\Models\Retro;
use App\Models\User;
use Illuminate\Routing\Events\RouteMatched;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Sleep;

/**
 * @param  array<string, mixed>  $attributes
 * @return array{
 *     0: Retro,
 *     1: array<int, Column>,
 *     2: User,
 *     3: User,
 *     4: Participant,
 *     5: Participant
 * }
 */
function plan06Board(RetroPhase $phase = RetroPhase::Writing, array $attributes = []): array
{
    $retro = Retro::factory()
        ->inPhase($phase)
        ->create(['title' => 'Sprint 14', ...$attributes]);

    $columns = [];

    foreach (['Start', 'Stop', 'Continue'] as $position => $title) {
        $columns[] = Column::factory()->create([
            'retro_id' => $retro->id,
            'title' => $title,
            'position' => $position,
        ]);
    }

    [$alice, $aliceParticipant] = retroFacilitator($retro);
    [$bob, $bobParticipant] = retroMember($retro);

    $alice->update(['name' => 'Alice Martin', 'locale' => 'en']);
    $bob->update(['name' => 'Bob Stone', 'locale' => 'en']);

    return [$retro->fresh(), $columns, $alice, $bob, $aliceParticipant, $bobParticipant];
}

function plan06Card(Retro $retro, Column $column, Participant $author, string $content, int $position = 0): Card
{
    return Card::factory()->create([
        'retro_id' => $retro->id,
        'column_id' => $column->id,
        'participant_id' => $author->id,
        'content' => $content,
        'position' => $position,
    ]);
}

function plan06Column(Column $column): string
{
    return "[data-test=\"retro-column-{$column->id}\"]";
}

function plan06RecordRequests(mixed $page): void
{
    $page->script(<<<'JS'
        () => {
            const state = { sent: [], loaded: [], held: [], hold: [] };
            const open = XMLHttpRequest.prototype.open;
            const send = XMLHttpRequest.prototype.send;

            XMLHttpRequest.prototype.open = function (method, url, ...rest) {
                this.plan06Request = `${String(method).toUpperCase()} ${new URL(String(url), window.location.href).pathname}`;

                return open.call(this, method, url, ...rest);
            };

            XMLHttpRequest.prototype.send = function (body) {
                const request = this.plan06Request;
                const deliver = this.onload;

                state.sent.push(request);

                this.onload = (event) => {
                    const finish = () => {
                        state.loaded.push(request);
                        deliver?.call(this, event);
                    };

                    if (state.hold.includes(request)) {
                        state.held.push(finish);

                        return;
                    }

                    finish();
                };

                return send.call(this, body);
            };

            window.plan06Requests = state;

            return true;
        }
        JS);
}

function plan06Hold(mixed $page, string $request): void
{
    $page->script("() => { window.plan06Requests.hold.push('{$request}'); return true; }");
}

function plan06Release(mixed $page): void
{
    $page->script('() => { window.plan06Requests.hold = []; window.plan06Requests.held.splice(0).forEach((finish) => finish()); return true; }');
}

function plan06Held(): string
{
    return 'window.plan06Requests.held.length';
}

function plan06Count(string $list, string $request): string
{
    return "window.plan06Requests.{$list}.filter((request) => request === '{$request}').length";
}

function plan06DoubleClick(mixed $page, string $selector): void
{
    $target = json_encode($selector, JSON_THROW_ON_ERROR);

    $page->script("() => { const button = document.querySelector({$target}); button.click(); button.click(); return true; }");
}

function plan06SignOutElsewhere(mixed $page): void
{
    $status = $page->script(<<<'JS'
        () => {
            const token = document.cookie.split('; ').find((cookie) => cookie.startsWith('XSRF-TOKEN=')).slice('XSRF-TOKEN='.length);

            return fetch('/logout', {
                method: 'POST',
                headers: { Accept: 'application/json', 'X-XSRF-TOKEN': decodeURIComponent(token) },
            }).then((response) => response.status);
        }
        JS);

    expect($status)->toBe(204);
}

it('[P06-02] keeps a vote cast while a snapshot refetch is in flight', function () {
    [$retro, $columns, $alice, $bob, $aliceParticipant] = plan06Board(RetroPhase::Voting, [
        'votes_per_participant' => 2,
    ]);
    $card = plan06Card($retro, $columns[0], $aliceParticipant, 'Slow CI');
    $snapshot = "GET /retros/{$retro->id}/snapshot";
    $vote = "POST /retros/{$retro->id}/cards/{$card->id}/votes";
    $addVote = "#card-{$card->id} [aria-label=\"Add a vote\"]";
    $showsTotal = "[...document.querySelectorAll('#card-{$card->id} [aria-label]')].some((element) => /^\\d+ votes?$/.test(element.getAttribute('aria-label')))";

    $bobPage = $this->awaitRealtime($this->signIn($bob, "/retros/{$retro->id}"));
    $alicePage = $this->awaitRealtime($this->signIn($alice, "/retros/{$retro->id}"));

    $bobPage->assertSee('Votes left: 2')
        ->assertScript($showsTotal, true);

    plan06RecordRequests($bobPage);
    plan06Hold($bobPage, $snapshot);

    $alicePage->click('[aria-label="Facilitator menu"]')
        ->assertSee('Settings…')
        ->click('Settings…')
        ->assertVisible('#retro-hide-vote-counts')
        ->click('#retro-hide-vote-counts')
        ->assertAriaAttribute('#retro-hide-vote-counts', 'checked', 'true')
        ->click('[role="dialog"] button[type="submit"]')
        ->assertNotPresent('[role="dialog"]');

    $bobPage->assertScript(plan06Held(), 1)
        ->click($addVote)
        ->assertScript(plan06Count('loaded', $vote), 1)
        ->assertSee('Votes left: 1')
        ->assertScript($showsTotal, true)
        ->assertScript(plan06Held(), 1);

    plan06Release($bobPage);

    $bobPage->assertScript($showsTotal, false)
        ->assertSee('Votes left: 1')
        ->assertSee('1 of 4 vote cast')
        ->assertScript("document.querySelector('#card-{$card->id} [aria-label=\"Remove a vote\"]').disabled", false);

    $alicePage->assertSee('1 of 4 vote cast');

    expect($retro->votes()->count())->toBe(1)
        ->and($retro->fresh()->hide_vote_counts)->toBeTrue();
});

it('[P06-03] shows a member their own card in a second tab during Writing and keeps it hidden from others', function () {
    [$retro, $columns, $alice, $bob] = plan06Board();
    $start = plan06Column($columns[0]);
    $composer = "{$start} textarea";
    $add = "{$start} form button:not([type=\"button\"])";

    $firstTab = $this->awaitRealtime($this->signIn($bob, "/retros/{$retro->id}"));
    $secondTab = $this->awaitRealtime($this->signIn($bob, "/retros/{$retro->id}"));
    $alicePage = $this->awaitRealtime($this->signIn($alice, "/retros/{$retro->id}"));

    $firstTab->fill($composer, 'Ship smaller pull requests')
        ->click($add)
        ->assertSeeIn('article[id^="card-"]', 'Ship smaller pull requests');

    $card = Card::query()->where('content', 'Ship smaller pull requests')->firstOrFail();

    $secondTab->assertSeeIn("#card-{$card->id}", 'Ship smaller pull requests')
        ->assertSeeIn("#card-{$card->id}", 'You')
        ->assertDontSee('Hidden until writing ends');

    $alicePage->assertSeeIn("#card-{$card->id}", 'Hidden until writing ends')
        ->assertDontSee('Ship smaller pull requests')
        ->assertScript('document.documentElement.outerHTML.includes("Ship smaller pull requests")', false);

    $firstTab->click("#card-{$card->id} button[aria-label=\"Edit card\"]")
        ->assertVisible("#card-{$card->id} textarea")
        ->fill("#card-{$card->id} textarea", 'Ship much smaller pull requests')
        ->click("#card-{$card->id} button:has-text(\"Save\")")
        ->assertSeeIn("#card-{$card->id}", 'Ship much smaller pull requests');

    $secondTab->assertSeeIn("#card-{$card->id}", 'Ship much smaller pull requests');

    $alicePage->assertSeeIn("#card-{$card->id}", 'Hidden until writing ends')
        ->assertScript('document.documentElement.outerHTML.includes("Ship much smaller pull requests")', false);

    expect($card->fresh()->content)->toBe('Ship much smaller pull requests');
});

it('[P06-04a] sends one request when the vote button is double-clicked', function () {
    [$retro, $columns, , $bob, $aliceParticipant] = plan06Board(RetroPhase::Voting);
    $card = plan06Card($retro, $columns[0], $aliceParticipant, 'Slow CI');
    $vote = "POST /retros/{$retro->id}/cards/{$card->id}/votes";
    $addVote = "#card-{$card->id} [aria-label=\"Add a vote\"]";

    $page = $this->awaitRealtime($this->signIn($bob, "/retros/{$retro->id}"));

    $page->assertSee('Votes left: 5')
        ->assertPresent($addVote);

    plan06RecordRequests($page);
    plan06DoubleClick($page, $addVote);

    $page->assertScript(plan06Count('loaded', $vote), 1)
        ->assertSee('Votes left: 4')
        ->assertScript(plan06Count('sent', $vote), 1);

    expect($retro->votes()->count())->toBe(1);
});

it('[P06-04b] sends one request when the delete button of a card is double-clicked', function () {
    [$retro, $columns, $alice, $bob, , $bobParticipant] = plan06Board();
    $card = plan06Card($retro, $columns[0], $bobParticipant, 'Flaky tests');
    $delete = "DELETE /retros/{$retro->id}/cards/{$card->id}";

    $alicePage = $this->awaitRealtime($this->signIn($alice, "/retros/{$retro->id}"));
    $bobPage = $this->awaitRealtime($this->signIn($bob, "/retros/{$retro->id}"));

    $bobPage->assertPresent("#card-{$card->id} [aria-label=\"Delete card\"]");

    plan06RecordRequests($bobPage);
    plan06DoubleClick($bobPage, "#card-{$card->id} [aria-label=\"Delete card\"]");

    $bobPage->assertNotPresent("#card-{$card->id}")
        ->assertScript(plan06Count('sent', $delete), 1)
        ->assertNotPresent('[data-sonner-toast]');

    $alicePage->assertNotPresent("#card-{$card->id}");

    expect(Card::query()->whereKey($card->id)->exists())->toBeFalse();
});

it('[P06-05] closes the card editor with a toast when the facilitator moves to Voting', function () {
    [$retro, $columns, $alice, $bob, , $bobParticipant] = plan06Board(RetroPhase::Grouping);
    $card = plan06Card($retro, $columns[0], $bobParticipant, 'Flaky tests');

    $alicePage = $this->awaitRealtime($this->signIn($alice, "/retros/{$retro->id}"));
    $bobPage = $this->awaitRealtime($this->signIn($bob, "/retros/{$retro->id}"));

    $bobPage->click("#card-{$card->id} button[aria-label=\"Edit card\"]")
        ->assertVisible("#card-{$card->id} textarea")
        ->fill("#card-{$card->id} textarea", 'Flaky tests on the CI runner');

    $alicePage->press('Next')
        ->assertSeeIn('[aria-current="step"]', 'Voting');

    $bobPage->assertSee('The phase changed before your edit was saved.')
        ->assertSeeIn('[aria-current="step"]', 'Voting')
        ->assertNotPresent("#card-{$card->id} textarea")
        ->assertSeeIn("#card-{$card->id}", 'Flaky tests')
        ->assertDontSee('Flaky tests on the CI runner');

    expect($card->fresh()->content)->toBe('Flaky tests');
});

it('[P06-06] keeps the delete-column dialog open when the server refuses the deletion', function () {
    [$retro, $columns, $alice, $bob] = plan06Board();
    $continue = plan06Column($columns[2]);

    $alicePage = $this->awaitRealtime($this->signIn($alice, "/retros/{$retro->id}"));
    $bobPage = $this->awaitRealtime($this->signIn($bob, "/retros/{$retro->id}"));

    $alicePage->click("{$continue} [aria-label=\"Column menu\"]")
        ->assertPresent('[role="menu"]')
        ->click('[role="menuitem"]:has-text("Delete column")')
        ->assertSeeIn('[role="dialog"]', 'Delete the column Continue?');

    $bobPage->fill("{$continue} textarea", 'Keep the demo on Fridays')
        ->click("{$continue} form button:not([type=\"button\"])")
        ->assertSee('Keep the demo on Fridays');

    $alicePage->assertCount('article[id^="card-"]', 1)
        ->click('[role="dialog"] button:has-text("Delete")')
        ->assertSee('This column still has cards.')
        ->assertSeeIn('[role="dialog"]', 'Delete the column Continue?')
        ->assertCount('[data-test^="retro-column-"]', 3);

    expect(Column::query()->whereKey($columns[2]->id)->exists())->toBeTrue();
});

it('[P06-07a] resets the title and the colour of the add-column form after a column is added', function () {
    [$retro, , $alice, $bob] = plan06Board();
    $form = 'form:has([role="radiogroup"])';
    $blue = "{$form} [role=\"radio\"][aria-label=\"Blue\"]";
    $green = "{$form} [role=\"radio\"][aria-label=\"Green\"]";

    $alicePage = $this->awaitRealtime($this->signIn($alice, "/retros/{$retro->id}"));
    $bobPage = $this->awaitRealtime($this->signIn($bob, "/retros/{$retro->id}"));

    $alicePage->assertAriaAttribute($green, 'checked', 'true')
        ->fill("{$form} input", 'Kudos')
        ->click($blue)
        ->assertAriaAttribute($blue, 'checked', 'true')
        ->click("{$form} button[type=\"submit\"]")
        ->assertCount('[data-test^="retro-column-"]', 4)
        ->assertValue("{$form} input", '')
        ->assertAriaAttribute($green, 'checked', 'true')
        ->assertAriaAttribute($blue, 'checked', 'false');

    $bobPage->assertCount('[data-test^="retro-column-"]', 4)
        ->assertSee('Kudos');

    expect($retro->columns()->where('title', 'Kudos')->sole()->color)->toBe(ColumnColor::Blue);
});

it('[P06-07b] disables the assignee select of the action-item form while the item is being saved', function () {
    [$retro, , , $bob] = plan06Board(RetroPhase::Discussing);
    $panel = '[data-test="retro-action-items-panel"]';
    $input = '[aria-label="Add an action item…"]';
    $store = "POST /retros/{$retro->id}/action-items";
    $assigneeIsDisabled = "document.querySelector('{$panel} form [aria-label=\"Assignee\"]').disabled";

    $page = $this->awaitRealtime($this->signIn($bob, "/retros/{$retro->id}"));

    $page->assertPresent($input)
        ->assertScript($assigneeIsDisabled, false);

    plan06RecordRequests($page);
    plan06Hold($page, $store);

    $page->fill($input, 'Automate the release notes')
        ->keys($input, 'Enter')
        ->assertScript(plan06Held(), 1)
        ->assertScript($assigneeIsDisabled, true);

    expect(ActionItem::query()->where('content', 'Automate the release notes')->count())->toBe(1);

    plan06Release($page);

    $page->assertSeeIn($panel, 'Automate the release notes')
        ->assertScript($assigneeIsDisabled, false)
        ->assertValue($input, '');
});

it('[P06-08a] shows the drag preview outside the scrolling board and as wide as the card', function () {
    [$retro, $columns, , $bob, , $bobParticipant] = plan06Board();
    $card = plan06Card($retro, $columns[2], $bobParticipant, 'Keep the demo on Fridays');
    $handle = "@retro-card-handle-{$card->id}";
    $preview = "document.querySelector('article:not([id])')";

    $page = $this->awaitRealtime($this->signIn($bob, "/retros/{$retro->id}"));

    $page->assertPresent($handle)
        ->assertScript("{$preview} === null", true);

    $page->keys($handle, 'Space')
        ->assertAttribute($handle, 'aria-pressed', 'true')
        ->assertScript("{$preview} !== null", true)
        ->assertScript("{$preview}.innerText.includes('Keep the demo on Fridays')", true)
        ->assertScript("{$preview}.closest('main') === null", true)
        ->assertScript("getComputedStyle({$preview}.parentElement).position", 'fixed')
        ->assertScript("Math.abs({$preview}.getBoundingClientRect().width - document.getElementById('card-{$card->id}').getBoundingClientRect().width) < 1", true)
        ->assertScript("(() => { const box = {$preview}.getBoundingClientRect(); return box.left >= 0 && box.right <= window.innerWidth && box.top >= 0; })()", true);

    $page->script('() => new Promise((resolve) => setTimeout(() => resolve(true), 0))');

    $page->keys($handle, 'Escape')
        ->assertAttributeMissing($handle, 'aria-pressed')
        ->assertScript("{$preview} === null", true);

    expect($card->fresh()->column_id)->toBe($columns[2]->id);
});

it('[P06-10a] shows one session-expired banner, freezes the board and sends Reload to the login page', function () {
    [$retro, $columns, $alice, $bob] = plan06Board();
    $start = plan06Column($columns[0]);
    $banner = '[role="alert"]:has-text("Your session has expired.")';
    $snapshot = "GET /retros/{$retro->id}/snapshot";

    $bobPage = $this->awaitRealtime($this->signIn($bob, "/retros/{$retro->id}"));
    $alicePage = $this->awaitRealtime($this->signIn($alice, "/retros/{$retro->id}"));

    $bobPage->assertNotPresent('[role="alert"]');

    plan06RecordRequests($bobPage);
    plan06SignOutElsewhere($bobPage);

    $bobPage->fill("{$start} textarea", 'Written after signing out')
        ->click("{$start} form button:not([type=\"button\"])")
        ->assertCount($banner, 1)
        ->assertScript("document.querySelector('[data-realtime] > div[inert]') !== null", true)
        ->assertNotPresent('[data-sonner-toast]');

    $alicePage->press('Next')
        ->assertSeeIn('[aria-current="step"]', 'Grouping');

    $bobPage->assertScript(plan06Count('loaded', $snapshot).' >= 1', true)
        ->assertCount($banner, 1)
        ->assertNotPresent('[data-sonner-toast]')
        ->assertSeeIn('[aria-current="step"]', 'Writing');

    expect($retro->cards()->count())->toBe(0);

    $bobPage->click('Reload')
        ->assertPathIs('/login');
});

it('[P06-10b] sends Reload to the session-ended page when the retro accepts guests', function () {
    [$retro, $columns, , $bob] = plan06Board(RetroPhase::Writing, ['guest_access_enabled' => true]);
    $start = plan06Column($columns[0]);

    $page = $this->awaitRealtime($this->signIn($bob, "/retros/{$retro->id}"));

    plan06SignOutElsewhere($page);

    $page->fill("{$start} textarea", 'Written after signing out')
        ->click("{$start} form button:not([type=\"button\"])")
        ->assertCount('[role="alert"]:has-text("Your session has expired.")', 1)
        ->click('Reload')
        ->assertSee('Your session has ended.')
        ->assertSee('Guests: ask the facilitator for the guest link.')
        ->assertSee('Log in')
        ->assertPathIs("/retros/{$retro->id}");

    expect($retro->cards()->count())->toBe(0);
});

it('[P06-11] shows the translated timeout message when the server stalls and lets the board recover', function () {
    [$retro, $columns, , $bob, $aliceParticipant] = plan06Board(RetroPhase::Voting);
    $bob->update(['locale' => 'fr']);
    $card = plan06Card($retro, $columns[0], $aliceParticipant, 'Slow CI');
    $addVote = "#card-{$card->id} [aria-label=\"Ajouter un vote\"]";
    $stalled = false;

    Event::listen(RouteMatched::class, function (RouteMatched $event) use (&$stalled): void {
        if ($stalled) {
            return;
        }

        if ($event->route->getName() !== 'retros.cards.votes.store') {
            return;
        }

        $stalled = true;

        Sleep::usleep(15_500_000);
    });

    $page = $this->awaitRealtime($this->signIn($bob, "/retros/{$retro->id}"));

    $page->assertSee('Votes restants : 5')
        ->click($addVote)
        ->assertSee("Le serveur n'a pas répondu à temps. Veuillez réessayer.")
        ->assertSee('Votes restants : 4');

    expect($stalled)->toBeTrue()
        ->and($retro->votes()->count())->toBe(1);

    $page->click($addVote)
        ->assertSee('Votes restants : 3')
        ->assertNotPresent('[role="alert"]');
});
