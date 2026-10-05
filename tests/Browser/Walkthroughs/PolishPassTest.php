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
function polishPassBoard(RetroPhase $phase = RetroPhase::Writing, array $attributes = []): array
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

function polishPassCompose(mixed $page, Column $column, string $content): mixed
{
    $composer = retroColumn($column).' [data-slot="retro-card-composer"] textarea';

    return $page->click(retroColumn($column).' [data-slot="retro-column-add"]')
        ->assertVisible($composer)
        ->fill($composer, $content);
}

function polishPassSave(Column $column): string
{
    return retroColumn($column).' [data-slot="retro-card-composer"] button[type="submit"]';
}

function polishPassRecordRequests(mixed $page): void
{
    $page->script(<<<'JS'
        () => {
            const state = { sent: [], loaded: [], held: [], hold: [] };
            const open = XMLHttpRequest.prototype.open;
            const send = XMLHttpRequest.prototype.send;

            XMLHttpRequest.prototype.open = function (method, url, ...rest) {
                this.polishPassRequest = `${String(method).toUpperCase()} ${new URL(String(url), window.location.href).pathname}`;

                return open.call(this, method, url, ...rest);
            };

            XMLHttpRequest.prototype.send = function (body) {
                const request = this.polishPassRequest;
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

            window.polishPassRequests = state;

            return true;
        }
        JS);
}

function polishPassHold(mixed $page, string $request): void
{
    $page->script("() => { window.polishPassRequests.hold.push('{$request}'); return true; }");
}

function polishPassRelease(mixed $page): void
{
    $page->script('() => { window.polishPassRequests.hold = []; window.polishPassRequests.held.splice(0).forEach((finish) => finish()); return true; }');
}

function polishPassHeld(): string
{
    return 'window.polishPassRequests.held.length';
}

function polishPassCount(string $list, string $request): string
{
    return "window.polishPassRequests.{$list}.filter((request) => request === '{$request}').length";
}

function polishPassDoubleClick(mixed $page, string $selector): void
{
    $target = json_encode($selector, JSON_THROW_ON_ERROR);

    $page->script("() => { const button = document.querySelector({$target}); button.click(); button.click(); return true; }");
}

it('keeps a vote cast while a snapshot refetch is in flight', function () {
    [$retro, $columns, $alice, $bob, $aliceParticipant] = polishPassBoard(RetroPhase::Voting, [
        'votes_per_participant' => 2,
    ]);
    $card = boardCard($retro, $columns[0], $aliceParticipant, 'Slow CI');
    $snapshot = "GET /retros/{$retro->id}/snapshot";
    $vote = "POST /retros/{$retro->id}/cards/{$card->id}/votes";
    $addVote = "#card-{$card->id} [aria-label=\"Add a vote\"]";
    $showsTotal = "[...document.querySelectorAll('#card-{$card->id} [aria-label]')].some((element) => /^\\d+ votes?$/.test(element.getAttribute('aria-label')))";

    $bobPage = $this->awaitRealtime($this->signIn($bob, "/retros/{$retro->id}"));
    $alicePage = $this->awaitRealtime($this->signIn($alice, "/retros/{$retro->id}"));

    $bobPage->assertSee('Votes left: 2')
        ->assertScript($showsTotal, true);

    polishPassRecordRequests($bobPage);
    polishPassHold($bobPage, $snapshot);

    $alicePage->click('[aria-label="Facilitator menu"]')
        ->assertSee('Settings…')
        ->click('Settings…')
        ->assertVisible('#retro-hide-vote-counts')
        ->click('#retro-hide-vote-counts')
        ->assertAriaAttribute('#retro-hide-vote-counts', 'checked', 'true')
        ->click('[role="dialog"] button:has-text("Apply")')
        ->assertSeeIn('[role="dialog"]', 'No changes')
        ->keys('[role="dialog"]', 'Escape')
        ->assertNotPresent('[role="dialog"]');

    $bobPage->assertScript(polishPassHeld(), 1)
        ->click($addVote)
        ->assertScript(polishPassCount('loaded', $vote), 1)
        ->assertSee('Votes left: 1')
        ->assertScript($showsTotal, true)
        ->assertScript(polishPassHeld(), 1);

    polishPassRelease($bobPage);

    $bobPage->assertScript($showsTotal, false)
        ->assertSee('Votes left: 1')
        ->assertSee('1 of 4 votes cast')
        ->assertScript("document.querySelector('#card-{$card->id} [aria-label=\"Remove a vote\"]').disabled", false);

    $alicePage->assertSee('1 of 4 votes cast');

    expect($retro->votes()->count())->toBe(1)
        ->and($retro->fresh()->hide_vote_counts)->toBeTrue();
});

it('shows a member their own card in a second tab during Writing and keeps it hidden from others', function () {
    [$retro, $columns, $alice, $bob] = polishPassBoard();
    $firstTab = $this->awaitRealtime($this->signIn($bob, "/retros/{$retro->id}"));
    $secondTab = $this->awaitRealtime($this->signIn($bob, "/retros/{$retro->id}"));
    $alicePage = $this->awaitRealtime($this->signIn($alice, "/retros/{$retro->id}"));

    polishPassCompose($firstTab, $columns[0], 'Ship smaller pull requests')
        ->click(polishPassSave($columns[0]))
        ->assertSeeIn('article[id^="card-"]', 'Ship smaller pull requests');

    $card = Card::query()->where('content', 'Ship smaller pull requests')->firstOrFail();

    $secondTab->assertSeeIn("#card-{$card->id}", 'Ship smaller pull requests')
        ->assertSeeIn("#card-{$card->id} [data-slot=\"retro-card-mine\"]", 'You')
        ->assertDontSee('Hidden until the reveal');

    $alicePage->assertSeeIn("#card-{$card->id}", 'Hidden until the reveal')
        ->assertDontSee('Ship smaller pull requests')
        ->assertScript('document.documentElement.outerHTML.includes("Ship smaller pull requests")', false);

    $firstTab->click("#card-{$card->id} button[aria-label=\"Edit card\"]")
        ->assertVisible("#card-{$card->id} textarea")
        ->fill("#card-{$card->id} textarea", 'Ship much smaller pull requests')
        ->click("#card-{$card->id} button:has-text(\"Save\")")
        ->assertSeeIn("#card-{$card->id}", 'Ship much smaller pull requests');

    $secondTab->assertSeeIn("#card-{$card->id}", 'Ship much smaller pull requests');

    $alicePage->assertSeeIn("#card-{$card->id}", 'Hidden until the reveal')
        ->assertScript('document.documentElement.outerHTML.includes("Ship much smaller pull requests")', false);

    expect($card->fresh()->content)->toBe('Ship much smaller pull requests');
});

it('sends one request when the vote button is double-clicked', function () {
    [$retro, $columns, , $bob, $aliceParticipant] = polishPassBoard(RetroPhase::Voting);
    $card = boardCard($retro, $columns[0], $aliceParticipant, 'Slow CI');
    $vote = "POST /retros/{$retro->id}/cards/{$card->id}/votes";
    $addVote = "#card-{$card->id} [aria-label=\"Add a vote\"]";

    $page = $this->awaitRealtime($this->signIn($bob, "/retros/{$retro->id}"));

    $page->assertSee('Votes left: 5')
        ->assertPresent($addVote);

    polishPassRecordRequests($page);
    polishPassDoubleClick($page, $addVote);

    $page->assertScript(polishPassCount('loaded', $vote), 1)
        ->assertSee('Votes left: 4')
        ->assertScript(polishPassCount('sent', $vote), 1);

    expect($retro->votes()->count())->toBe(1);
});

it('sends one request when the delete button of a card is double-clicked', function () {
    [$retro, $columns, $alice, $bob, , $bobParticipant] = polishPassBoard();
    $card = boardCard($retro, $columns[0], $bobParticipant, 'Flaky tests');
    $delete = "DELETE /retros/{$retro->id}/cards/{$card->id}";

    $alicePage = $this->awaitRealtime($this->signIn($alice, "/retros/{$retro->id}"));
    $bobPage = $this->awaitRealtime($this->signIn($bob, "/retros/{$retro->id}"));

    $bobPage->assertPresent("#card-{$card->id} [aria-label=\"Delete card\"]");

    polishPassRecordRequests($bobPage);
    polishPassDoubleClick($bobPage, "#card-{$card->id} [aria-label=\"Delete card\"]");

    $bobPage->assertNotPresent("#card-{$card->id}")
        ->assertScript(polishPassCount('sent', $delete), 1)
        ->assertNotPresent('[data-sonner-toast]');

    $alicePage->assertNotPresent("#card-{$card->id}");

    expect(Card::query()->whereKey($card->id)->exists())->toBeFalse();
});

it('closes the card editor with a toast when the facilitator moves to Voting', function () {
    [$retro, $columns, $alice, $bob, , $bobParticipant] = polishPassBoard(RetroPhase::Grouping);
    $card = boardCard($retro, $columns[0], $bobParticipant, 'Flaky tests');

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

it('keeps the delete-column dialog open when the server refuses the deletion', function () {
    [$retro, $columns, $alice, $bob] = polishPassBoard();
    $continue = retroColumn($columns[2]);

    $alicePage = $this->awaitRealtime($this->signIn($alice, "/retros/{$retro->id}"));
    $bobPage = $this->awaitRealtime($this->signIn($bob, "/retros/{$retro->id}"));

    $alicePage->click("{$continue} [aria-label=\"Column menu\"]")
        ->assertPresent('[role="menu"]')
        ->click('[role="menuitem"]:has-text("Delete column")')
        ->assertSeeIn('[role="alertdialog"]', 'Delete the column Continue?');

    polishPassCompose($bobPage, $columns[2], 'Keep the demo on Fridays')
        ->click(polishPassSave($columns[2]))
        ->assertSee('Keep the demo on Fridays');

    $alicePage->assertCount('article[id^="card-"]', 1)
        ->click('[role="alertdialog"] button:has-text("Delete")')
        ->assertSee('This column still has cards.')
        ->assertSeeIn('[role="alertdialog"]', 'Delete the column Continue?')
        ->assertCount('[data-test^="retro-column-"]', 3);

    expect(Column::query()->whereKey($columns[2]->id)->exists())->toBeTrue();
});

it('resets the title and the colour of the add-column form after a column is added', function () {
    [$retro, , $alice, $bob] = polishPassBoard();
    $form = 'form:has([role="radiogroup"])';
    $sky = "{$form} [role=\"radio\"][aria-label=\"Sky\"]";
    $moss = "{$form} [role=\"radio\"][aria-label=\"Moss\"]";

    $alicePage = $this->awaitRealtime($this->signIn($alice, "/retros/{$retro->id}"));
    $bobPage = $this->awaitRealtime($this->signIn($bob, "/retros/{$retro->id}"));

    $alicePage->click('[data-slot="retro-add-column-tile"]')
        ->assertAriaAttribute($moss, 'checked', 'true')
        ->fill("{$form} input", 'Kudos')
        ->click($sky)
        ->assertAriaAttribute($sky, 'checked', 'true')
        ->click("{$form} button[type=\"submit\"]")
        ->assertCount('[data-test^="retro-column-"]', 4)
        ->assertValue("{$form} input", '')
        ->assertAriaAttribute($moss, 'checked', 'true')
        ->assertAriaAttribute($sky, 'checked', 'false');

    $bobPage->assertCount('[data-test^="retro-column-"]', 4)
        ->assertSee('Kudos');

    expect($retro->columns()->where('title', 'Kudos')->sole()->color)->toBe(ColumnColor::Sky);
});

it('disables the assignee select of the action-item form while the item is being saved', function () {
    [$retro, , , $bob] = polishPassBoard(RetroPhase::Discussing);
    $panel = '[data-test="retro-action-items-panel"]';
    $input = '[aria-label="Add an action item…"]';
    $store = "POST /retros/{$retro->id}/action-items";
    $assigneeIsDisabled = "document.querySelector('{$panel} form [aria-label=\"Assignee\"]').disabled";

    $page = $this->awaitRealtime($this->signIn($bob, "/retros/{$retro->id}"));

    $page->assertPresent($input)
        ->assertScript($assigneeIsDisabled, false);

    polishPassRecordRequests($page);
    polishPassHold($page, $store);

    $page->fill($input, 'Automate the release notes')
        ->keys($input, 'Enter')
        ->assertScript(polishPassHeld(), 1)
        ->assertScript($assigneeIsDisabled, true);

    expect(ActionItem::query()->where('content', 'Automate the release notes')->count())->toBe(1);

    polishPassRelease($page);

    $page->assertSeeIn($panel, 'Automate the release notes')
        ->assertScript($assigneeIsDisabled, false)
        ->assertValue($input, '');
});

it('shows the drag preview outside the scrolling board and as wide as the card', function () {
    [$retro, $columns, , $bob, , $bobParticipant] = polishPassBoard();
    $card = boardCard($retro, $columns[2], $bobParticipant, 'Keep the demo on Fridays');
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

it('shows one session-expired banner, freezes the board and sends Reload to the login page', function () {
    [$retro, $columns, $alice, $bob] = polishPassBoard();
    $banner = '[role="alert"]:has-text("Your session has expired.")';
    $snapshot = "GET /retros/{$retro->id}/snapshot";

    $bobPage = $this->awaitRealtime($this->signIn($bob, "/retros/{$retro->id}"));
    $alicePage = $this->awaitRealtime($this->signIn($alice, "/retros/{$retro->id}"));

    $bobPage->assertNotPresent('[role="alert"]');

    polishPassRecordRequests($bobPage);
    expect($this->sendFromPage($bobPage, 'POST', '/logout')['status'])->toBe(204);

    polishPassCompose($bobPage, $columns[0], 'Written after signing out')
        ->click(polishPassSave($columns[0]))
        ->assertCount($banner, 1)
        ->assertScript("document.querySelector('[data-realtime] > div[inert]') !== null", true)
        ->assertNotPresent('[data-sonner-toast]');

    $alicePage->press('Next')
        ->assertSeeIn('[aria-current="step"]', 'Grouping');

    $bobPage->assertScript(polishPassCount('loaded', $snapshot).' >= 1', true)
        ->assertCount($banner, 1)
        ->assertNotPresent('[data-sonner-toast]')
        ->assertSeeIn('[aria-current="step"]', 'Writing');

    expect($retro->cards()->count())->toBe(0);

    $bobPage->click('Reload')
        ->assertPathIs('/login');
});

it('sends Reload to the session-ended page when the retro accepts guests', function () {
    [$retro, $columns, , $bob] = polishPassBoard(RetroPhase::Writing, ['guest_access_enabled' => true]);
    $page = $this->awaitRealtime($this->signIn($bob, "/retros/{$retro->id}"));

    expect($this->sendFromPage($page, 'POST', '/logout')['status'])->toBe(204);

    polishPassCompose($page, $columns[0], 'Written after signing out')
        ->click(polishPassSave($columns[0]))
        ->assertCount('[role="alert"]:has-text("Your session has expired.")', 1)
        ->click('Reload')
        ->assertSee('Your session has ended.')
        ->assertSee('Guests: ask the facilitator for the guest link.')
        ->assertSee('Log in')
        ->assertPathIs("/retros/{$retro->id}");

    expect($retro->cards()->count())->toBe(0);
});

it('shows the translated timeout message when the server stalls and lets the board recover', function () {
    [$retro, $columns, , $bob, $aliceParticipant] = polishPassBoard(RetroPhase::Voting);
    $bob->update(['locale' => 'fr']);
    $card = boardCard($retro, $columns[0], $aliceParticipant, 'Slow CI');
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

        Sleep::usleep(2_500_000);
    });

    $page = $this->awaitRealtime($this->signIn($bob, "/retros/{$retro->id}"));

    $page->script('() => { window.polishPassTimeout = AbortSignal.timeout; AbortSignal.timeout = (milliseconds) => window.polishPassTimeout.call(AbortSignal, milliseconds === 15000 ? 2000 : milliseconds); return true; }');

    $page->assertSee('Votes restants : 5')
        ->click($addVote)
        ->assertSee("Le serveur n'a pas répondu à temps. Réessaie.")
        ->assertSee('Votes restants : 4');

    $page->script('() => { AbortSignal.timeout = window.polishPassTimeout; return true; }');

    expect($stalled)->toBeTrue()
        ->and($retro->votes()->count())->toBe(1);

    $page->click($addVote)
        ->assertSee('Votes restants : 3')
        ->assertNotPresent('[role="alert"]');
});
