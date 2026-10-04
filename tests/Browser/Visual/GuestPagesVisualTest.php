<?php

use App\Enums\JoinableSessionKind;
use App\Enums\RetroPhase;
use App\Enums\WorkspaceRole;
use App\Models\Participant;
use App\Models\Retro;
use App\Models\SessionJoinCode;
use App\Models\Team;
use App\Models\User;
use App\Models\Workspace;
use BaconQrCode\Common\ErrorCorrectionLevel;
use BaconQrCode\Renderer\Image\SvgImageBackEnd;
use BaconQrCode\Renderer\ImageRenderer;
use BaconQrCode\Renderer\RendererStyle\RendererStyle;
use BaconQrCode\Writer;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Support\Facades\RateLimiter;

const P26GuestToken = 'visual-guest-token-of-the-guest-pages-0001';

const P26PinnedOrigin = 'https://skrum.example';

/**
 * A retro of the Atlas team open to guests, facilitated by Fran, with three
 * people who already joined and chose the colours 2, 5 and 9.
 *
 * @return array{
 *     0: Retro,
 *     1: User
 * }
 */
function p26GuestVisualRetro(): array
{
    $workspace = Workspace::factory()->create(['name' => 'Nordlys']);
    $team = Team::factory()->for($workspace)->create(['name' => 'Atlas']);
    $retro = Retro::factory()->inPhase(RetroPhase::Writing)->withGuestAccess()->create([
        'id' => '0199c000-0000-7000-8000-000000000001',
        'team_id' => $team->id,
        'title' => 'Sprint 42 retro · Atlas team',
        'guest_token' => P26GuestToken,
    ]);

    $people = [
        ['Fran Facilitator', 'fran@example.com', 2],
        ['Maximilian Alexander von Hohenberg-Lichtenstein', 'max@example.com', 5],
        ['Ines Ortega', 'ines@example.com', 9],
    ];
    $participants = [];

    foreach ($people as $index => [$name, $email, $colour]) {
        $user = User::factory()->create([
            'id' => "0199c000-0000-7000-8000-00000000001{$index}",
            'name' => $name,
            'email' => $email,
            'presence_color' => $colour,
        ]);
        $workspace->members()->attach($user, ['role' => WorkspaceRole::Member->value]);
        $team->members()->attach($user);

        $participants[] = [$user, Participant::factory()->create([
            'id' => "0199c000-0000-7000-8000-00000000002{$index}",
            'retro_id' => $retro->id,
            'user_id' => $user->id,
        ])];
    }

    $retro->forceFill(['facilitator_participant_id' => $participants[0][1]->id])->save();

    return [$retro->fresh(), $participants[0][0]];
}

/**
 * The QR code of the link, drawn for the pinned address: the test server
 * listens on another port on every run, so the code drawn in the page would
 * change the picture each time.
 */
function p26PinnedQrCode(string $url): string
{
    $svg = new Writer(new ImageRenderer(new RendererStyle(256, 4), new SvgImageBackEnd))
        ->writeString($url, 'UTF-8', ErrorCorrectionLevel::M());

    return str_replace(['fill="#000000"', 'fill="#ffffff"'], ['fill="currentColor"', 'fill="transparent"'], substr($svg, (int) strpos($svg, '<svg')));
}

/**
 * The link, the "Join at" line and the QR code hold the address of the test
 * server: they are replaced with the pinned one in the picture.
 */
function p26PinShareDialog(mixed $page): mixed
{
    $qrCode = json_encode(p26PinnedQrCode(P26PinnedOrigin.'/join/'.P26GuestToken), JSON_THROW_ON_ERROR);
    $origin = json_encode(P26PinnedOrigin, JSON_THROW_ON_ERROR);
    $host = json_encode(parse_url(P26PinnedOrigin, PHP_URL_HOST), JSON_THROW_ON_ERROR);

    $page->script(<<<JS
        () => {
            const dialog = document.querySelector('[data-slot="share-dialog"]');
            const pin = (text) => text.replaceAll(location.origin, {$origin}).replaceAll(location.host, {$host});

            for (const input of dialog.querySelectorAll('input')) {
                input.value = pin(input.value);
            }

            const walker = document.createTreeWalker(dialog, NodeFilter.SHOW_TEXT);

            for (let node = walker.nextNode(); node; node = walker.nextNode()) {
                node.nodeValue = pin(node.nodeValue);
            }

            const drawn = dialog.querySelector('[data-slot="share-qr"] svg');
            const template = document.createElement('template');

            template.innerHTML = {$qrCode};

            const pinned = template.content.querySelector('svg');

            pinned.setAttribute('class', drawn.getAttribute('class'));
            pinned.setAttribute('aria-hidden', 'true');
            pinned.removeAttribute('width');
            pinned.removeAttribute('height');
            drawn.replaceWith(pinned);

            return true;
        }
        JS);

    return $page;
}

it('renders the guest join of a retro with three colours taken without overflow', function () {
    config(['app.name' => 'Skrum']);

    p26GuestVisualRetro();

    $this->captureVisuals(
        'guest-join-colours',
        '/join/'.P26GuestToken,
        fn (string $path, array $options) => visit($path, $options)
            ->assertPresent('[data-slot="guest-join"] #name')
            ->assertCount('[data-slot="guest-join"] [data-slot="presence-swatch-taken"]', 3)
            ->fill('#name', 'Nadia'),
    );
});

it('renders the share dialog of a retro with its session code without overflow', function () {
    config(['app.name' => 'Skrum', 'app.key' => 'base64:'.base64_encode(str_repeat('v', 32))]);
    RateLimiter::for('login', fn (): Limit => Limit::none());

    [$retro, $facilitator] = p26GuestVisualRetro();

    SessionJoinCode::factory()->create([
        'code' => 'K7Q-P4M2',
        'session_kind' => JoinableSessionKind::Retro,
        'session_id' => $retro->id,
    ]);

    $this->captureVisuals(
        'share-dialog-code',
        "/retros/{$retro->id}",
        function (string $path, array $options) use ($facilitator) {
            $french = str_starts_with($options['locale'], 'fr');

            User::query()->whereKey($facilitator->id)->update(['locale' => $french ? 'fr' : 'en']);

            $page = visit('/login', $options);

            $page->fill('#email', $facilitator->email)
                ->fill('#password', 'password')
                ->click('@login-button')
                ->assertPathIsNot('/login');

            $page->navigate($path)
                ->assertAttribute('[data-realtime]', 'data-realtime', 'connected')
                ->click($french ? 'button:has-text("Partager")' : 'button:has-text("Share")')
                ->assertSeeIn('[data-slot="share-dialog"] [data-slot="share-code"]', 'K7Q-P4M2')
                ->assertPresent('[data-slot="share-dialog"] [data-slot="share-qr"] svg');

            return p26PinShareDialog($page);
        },
    );
});

it('renders the join-by-code page with a code too short without overflow', function () {
    config(['app.name' => 'Skrum']);

    $this->captureVisuals(
        'join-code',
        '/join',
        fn (string $path, array $options) => visit($path, $options)
            ->assertPresent('[data-slot="join-code"] #code')
            ->fill('#code', 'K7Q-P4')
            ->click('[data-slot="join-code-action"] button[type="submit"]')
            ->assertPresent('[data-slot="join-code"] [data-slot="field-error"]')
            ->assertAttribute('#code', 'aria-invalid', 'true'),
    );
});
