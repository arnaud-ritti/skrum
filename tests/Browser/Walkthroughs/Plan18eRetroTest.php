<?php

use App\Enums\ColumnColor;
use App\Enums\RetroPhase;
use App\Models\Column;
use App\Models\Retro;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Tests\Browser\Support\ReverbServer;

it('[P18e-02-05] renders a board with the eight colours, shows a migrated green column as Moss and recolours it for everyone', function () {
    $retro = Retro::factory()->create(['title' => 'Eight colours']);
    $columns = [];

    foreach (ColumnColor::cases() as $position => $color) {
        $columns[$color->value] = Column::factory()->create([
            'retro_id' => $retro->id,
            'title' => ucfirst($color->value),
            'color' => $color,
            'position' => $position,
        ]);
    }

    $migrated = $columns['moss'];
    DB::table('columns')->where('id', $migrated->id)->update(['color' => 'green']);
    (require database_path('migrations/2026_10_15_100300_map_column_colors_to_the_eight_theme_colors.php'))->up();

    [$alice] = retroFacilitator($retro);
    [$bob] = retroMember($retro);
    $alice->update(['locale' => 'en']);
    $bob->update(['locale' => 'en']);

    $alicePage = $this->awaitRealtime($this->signIn($alice, "/retros/{$retro->id}"));
    $bobPage = $this->awaitRealtime($this->signIn($bob, "/retros/{$retro->id}"));

    $alicePage->assertCount('[data-test^="retro-column-"]', 8);

    foreach ($columns as $color => $column) {
        $alicePage->assertPresent("[data-test=\"retro-column-{$column->id}\"].col-{$color}");
    }

    $moss = "[data-test=\"retro-column-{$migrated->id}\"]";

    $alicePage->click("{$moss} [aria-label=\"Column menu\"]")
        ->click('[role="menuitem"]:has-text("Color")')
        ->assertCount('[role="menu"] [role="menuitemradio"]', 8)
        ->assertAriaAttribute('[role="menuitemradio"]:has-text("Moss")', 'checked', 'true')
        ->click('[role="menuitemradio"]:has-text("Lagoon")')
        ->assertPresent("{$moss}.col-lagoon")
        ->assertNotPresent("{$moss}.col-moss");

    $bobPage->assertPresent("{$moss}.col-lagoon");

    expect($migrated->fresh()->color)->toBe(ColumnColor::Lagoon);
});

/**
 * @return array{
 *     0: Retro,
 *     1: User,
 *     2: User
 * }
 */
function p18eShellBoard(bool $acceptsGuests = false): array
{
    $retro = Retro::factory()->inPhase(RetroPhase::Writing)->create([
        'title' => 'Sprint 42',
        'guest_access_enabled' => $acceptsGuests,
    ]);

    foreach (['Start', 'Stop', 'Continue'] as $position => $title) {
        Column::factory()->create(['retro_id' => $retro->id, 'title' => $title, 'position' => $position]);
    }

    [$alice] = retroFacilitator($retro);
    [$bob] = retroMember($retro);
    $alice->update(['name' => 'Alice Martin', 'locale' => 'en']);
    $bob->update(['name' => 'Bob Stone', 'locale' => 'en']);

    return [$retro->fresh(), $alice, $bob];
}

function p18eTimerSeconds(): string
{
    return "(() => { const [minutes, seconds] = document.querySelector('[role=\"timer\"]').textContent.trim().split(':').map(Number); return minutes * 60 + seconds; })()";
}

it('[P18e-02-08] keeps one realtime root, says what is true while reconnecting, and freezes the board under the expired banner until the viewer is back', function () {
    [$retro, $alice, $bob] = p18eShellBoard();
    $banner = '[data-slot="connection-state"][data-variant="banner"]';
    $expired = '[role="alert"]:has-text("Your session has expired.")';
    $isInert = "document.querySelector('[data-slot=\"retro-body\"]').closest('[inert]') !== null";
    $bannerIsFullWidth = "(() => { const banner = document.querySelector('{$banner}').getBoundingClientRect(); const main = document.querySelector('main').getBoundingClientRect(); return banner.left - main.left <= 16 && main.right - banner.right <= 16; })()";
    $bannerClearsTheReactions = "document.querySelector('{$banner}').getBoundingClientRect().bottom <= document.querySelector('[role=\"toolbar\"][aria-label=\"Reactions\"]').getBoundingClientRect().top";

    $alicePage = $this->awaitRealtime($this->signIn($alice, "/retros/{$retro->id}"));
    $bobPage = $this->awaitRealtime($this->signIn($bob, "/retros/{$retro->id}"));

    foreach ([$alicePage, $bobPage] as $page) {
        $page->assertCount('[data-realtime]', 1)
            ->assertScript("document.querySelectorAll('main').length", 1)
            ->assertNotPresent($banner)
            ->assertScript($isInert, false);
    }

    ReverbServer::stop();

    try {
        foreach ([$alicePage, $bobPage] as $page) {
            $page->assertSeeIn($banner, 'Reconnecting…')
                ->assertSeeIn($banner, 'Live updates are paused. What you see may be out of date.')
                ->assertDontSee('kept locally')
                ->assertCount('[data-realtime]', 1)
                ->assertPresent('[data-slot="session-connection-pill"][aria-hidden="true"]')
                ->assertScript($bannerIsFullWidth, true)
                ->assertScript($bannerClearsTheReactions, true)
                ->assertScript($isInert, false);
        }
    } finally {
        ReverbServer::start();
    }

    foreach ([$alicePage, $bobPage] as $page) {
        $page->assertNotPresent($banner)
            ->assertAttribute('[data-realtime]', 'data-realtime', 'connected')
            ->assertCount('[data-realtime]', 1);
    }

    $status = $bobPage->script(<<<'JS'
        () => {
            const token = document.cookie.split('; ').find((cookie) => cookie.startsWith('XSRF-TOKEN=')).slice('XSRF-TOKEN='.length);

            return fetch('/logout', {
                method: 'POST',
                headers: { Accept: 'application/json', 'X-XSRF-TOKEN': decodeURIComponent(token) },
            }).then((response) => response.status);
        }
        JS);

    expect($status)->toBe(204);

    $alicePage->press('Next')
        ->assertSeeIn('[aria-current="step"]', 'Grouping');

    $bobPage->assertCount($expired, 1)
        ->assertCount('[data-realtime]', 1)
        ->assertScript($isInert, true)
        ->assertSeeIn('[aria-current="step"]', 'Writing')
        ->click('Reload')
        ->assertPathIs('/login')
        ->fill('#email', $bob->email)
        ->fill('#password', 'password')
        ->click('@login-button')
        ->assertPathIs("/retros/{$retro->id}");

    $this->awaitRealtime($bobPage)
        ->assertNotPresent($expired)
        ->assertScript($isInert, false)
        ->assertSeeIn('[aria-current="step"]', 'Grouping')
        ->assertCount('[data-realtime]', 1);
});

it('[P18e-02-09] offers "+2 min" to the facilitator while a timer runs and moves the countdown of a guest by two minutes', function () {
    [$retro, $alice] = p18eShellBoard(acceptsGuests: true);
    $extend = 'button:has-text("+2 min")';

    $alicePage = $this->awaitRealtime($this->signIn($alice, "/retros/{$retro->id}"));
    $carolPage = $this->awaitRealtime($this->joinAsGuest("/join/{$retro->guest_token}", 'Carol Guest'));

    $alicePage->assertNotPresent($extend)
        ->click('[aria-label="Timer"]')
        ->assertSee('1 min')
        ->click('1 min')
        ->assertPresent('[role="timer"]')
        ->assertVisible($extend);

    $carolPage->assertPresent('[role="timer"]')
        ->assertNotPresent($extend)
        ->assertNotPresent('[aria-label="Timer"]')
        ->assertScript(p18eTimerSeconds().' <= 60', true);

    $endsAt = $retro->fresh()->timer_ends_at;

    $alicePage->click($extend)
        ->assertScript(p18eTimerSeconds().' > 120', true);

    $carolPage->assertScript(p18eTimerSeconds().' > 120', true)
        ->assertScript(p18eTimerSeconds().' <= 180', true)
        ->assertNotPresent($extend);

    expect((int) $endsAt->diffInSeconds($retro->fresh()->timer_ends_at))->toBe(120);
});

it('[P18e-02-10] counts the cards and who has written in the Writing banner, live for everyone', function (bool $isAnonymous) {
    [$retro, $alice, $bob] = p18eShellBoard();
    $retro->update(['is_anonymous' => $isAnonymous]);
    $start = $retro->columns()->orderBy('position')->firstOrFail();
    $composer = "[data-test=\"retro-column-{$start->id}\"] textarea";
    $progress = '[data-slot="retro-writing-progress"]';
    $bar = '[data-slot="facilitator-bar"]';

    $alicePage = $this->awaitRealtime($this->signIn($alice, "/retros/{$retro->id}"));
    $bobPage = $this->awaitRealtime($this->signIn($bob, "/retros/{$retro->id}"));

    foreach ([$alicePage, $bobPage] as $page) {
        $page->assertSee('Silent writing: your cards are only visible to you until the reveal.')
            ->assertSeeIn($progress, '0 cards · 0/2 have written');
    }

    $isAnonymous
        ? $alicePage->assertSeeIn($bar, 'Anonymity: on')
        : $alicePage->assertDontSee('Anonymity: on');

    $bobPage->type($composer, 'Ship smaller pull requests')
        ->keys($composer, 'Enter')
        ->assertSeeIn($progress, '1 card · 1/2 have written')
        ->assertSeeIn('article[id^="card-"]', 'Visible only to you');

    $alicePage->assertSeeIn($progress, '1 card · 1/2 have written')
        ->assertSeeIn('article[id^="card-"]', 'Hidden until the reveal')
        ->assertDontSee('Visible only to you');

    $bobPage->type($composer, 'Pair on reviews')
        ->keys($composer, 'Enter')
        ->assertSeeIn($progress, '2 cards · 1/2 have written');

    $alicePage->assertSeeIn($progress, '2 cards · 1/2 have written');

    $alicePage->type($composer, 'Keep the demo on Fridays')
        ->keys($composer, 'Enter')
        ->assertSeeIn($progress, '3 cards · 2/2 have written');

    $bobPage->assertSeeIn($progress, '3 cards · 2/2 have written');

    $card = $retro->cards()->where('content', 'Keep the demo on Fridays')->sole();

    $alicePage->click("#card-{$card->id} [aria-label=\"Delete card\"]")
        ->assertSeeIn($progress, '2 cards · 1/2 have written');

    $bobPage->assertSeeIn($progress, '2 cards · 1/2 have written');

    $alicePage->press('Next')
        ->assertSeeIn('[aria-current="step"]', 'Grouping')
        ->assertNotPresent($progress)
        ->assertDontSee('Anonymity: on');
})->with([
    'named retro' => false,
    'anonymous retro' => true,
]);
