<?php

use App\Actions\Auth\ConsumeMagicLink;
use App\Actions\Auth\IssueMagicLink;
use App\Jobs\Auth\SendMagicLink;
use App\Mail\MagicLinkMail;
use App\Models\MagicLink;
use App\Models\User;
use Illuminate\Contracts\Queue\ShouldBeEncrypted;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Queue;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    config(['mail.default' => 'smtp']);
    Mail::fake();
});

function magicLinkFor(User $user): string
{
    return resolve(IssueMagicLink::class)->handle($user);
}

function magicLinkToken(string $url): string
{
    return basename((string) parse_url($url, PHP_URL_PATH));
}

function consumeUrl(string $url): string
{
    return route('magicLinks.sessions.store', magicLinkToken($url));
}

it('answers the same way for every address', function (string $email) {
    User::factory()->create(['email' => 'known@example.test']);
    User::factory()->unverified()->create(['email' => 'unverified@example.test']);

    $this->from(route('login'))->post(route('magicLinks.store'), ['email' => $email])
        ->assertRedirect(route('login'))
        ->assertSessionHas('status', 'magic-link-sent')
        ->assertSessionHasNoErrors();

    $this->from(route('login'))->post(route('magicLinks.store'), ['email' => $email])
        ->assertRedirect(route('login'))
        ->assertSessionHas('status', 'magic-link-sent')
        ->assertSessionHasNoErrors();
})->with(['known@example.test', 'nobody@example.test', 'unverified@example.test']);

it('dispatches the same job for every address and never reads the users table', function (string $email) {
    Queue::fake();
    User::factory()->create(['email' => 'known@example.test']);
    $userQueries = 0;
    DB::listen(function ($query) use (&$userQueries): void {
        $userQueries += str_contains($query->sql, '"users"') ? 1 : 0;
    });

    $this->post(route('magicLinks.store'), ['email' => $email]);

    Queue::assertPushed(SendMagicLink::class, 1);
    expect($userQueries)->toBe(0);
})->with(['known@example.test', 'nobody@example.test']);

it('mails a verified account only', function () {
    User::factory()->create(['email' => 'known@example.test']);
    User::factory()->unverified()->create(['email' => 'unverified@example.test']);
    $users = User::query()->count();

    foreach (['Known@Example.test', 'nobody@example.test', 'unverified@example.test'] as $email) {
        $this->post(route('magicLinks.store'), ['email' => $email]);
    }

    Mail::assertSentCount(1);
    Mail::assertSent(MagicLinkMail::class, fn (MagicLinkMail $mail): bool => $mail->hasTo('known@example.test'));
    expect(User::query()->count())->toBe($users)
        ->and(User::query()->firstWhere('email', 'unverified@example.test')->email_verified_at)->toBeNull();
});

it('sends nothing when the address is ambiguous', function () {
    User::factory()->create(['email' => 'twin@example.test']);
    User::factory()->storedWithAddress('Twin@example.test')->create();

    $this->post(route('magicLinks.store'), ['email' => 'twin@example.test'])->assertSessionHas('status', 'magic-link-sent');

    Mail::assertNothingSent();
});

it('sends nothing when mail does not deliver', function (string $mailer) {
    Queue::fake();
    config(['mail.default' => $mailer]);
    $user = User::factory()->create();

    $this->post(route('magicLinks.store'), ['email' => $user->email])->assertSessionHas('status', 'magic-link-sent');

    Queue::assertNothingPushed();
})->with(['log', 'array']);

it('tells the login page whether links are available', function (string $mailer, bool $available) {
    config(['mail.default' => $mailer]);

    $this->get(route('login'))->assertInertia(fn (Assert $page) => $page->where('canUseMagicLink', $available));
})->with([['smtp', true], ['log', false]]);

it('stores only a hash and flashes nothing secret', function () {
    $user = User::factory()->create();

    $this->post(route('magicLinks.store'), ['email' => $user->email]);

    $url = '';
    Mail::assertSent(MagicLinkMail::class, function (MagicLinkMail $mail) use (&$url): bool {
        $url = $mail->url;

        return true;
    });
    $token = magicLinkToken($url);
    $link = MagicLink::query()->sole();

    expect($token)->toMatch('/^[A-Za-z0-9]{64}$/')
        ->and($link->token_hash)->toBe(hash('sha256', $token))
        ->and((string) json_encode($link->getAttributes()))->not->toContain($token)
        ->and((string) json_encode(session()->all()))->not->toContain($token);
});

it('queued work is encrypted', function () {
    expect(new SendMagicLink('a@example.test'))->toBeInstanceOf(ShouldBeEncrypted::class)
        ->and(new MagicLinkMail('https://skrum.test/x', 'a@example.test', 15))->toBeInstanceOf(ShouldBeEncrypted::class);
});

it('GET and HEAD neither sign in nor consume', function () {
    $user = User::factory()->create(['email' => 'known@example.test']);
    $url = magicLinkFor($user);

    $this->call('HEAD', $url)->assertOk();
    $this->get($url)
        ->assertOk()
        ->assertHeader('Referrer-Policy', 'no-referrer')
        ->assertInertia(fn (Assert $page) => $page
            ->component('auth/magic-link')
            ->where('email', 'k…@example.test')
            ->where('confirmUrl', consumeUrl($url)));
    $this->get($url)->assertOk();

    $this->assertGuest();
    expect(MagicLink::query()->sole()->consumed_at)->toBeNull();
});

it('shows the invalid state for a tampered or unknown link', function () {
    $url = magicLinkFor(User::factory()->create());

    foreach ([$url.'0', str_replace(magicLinkToken($url), str_repeat('a', 64), $url)] as $bad) {
        $this->get($bad)->assertOk()->assertInertia(fn (Assert $page) => $page
            ->component('auth/magic-link')
            ->where('email', null)
            ->where('confirmUrl', null));
    }
});

it('signs in on POST and works once', function () {
    $user = User::factory()->create();
    $url = magicLinkFor($user);

    $this->post(consumeUrl($url))->assertRedirect(route('dashboard'));
    $this->assertAuthenticatedAs($user);

    auth()->logout();
    $this->flushSession();

    $this->post(consumeUrl($url))->assertRedirect(route('login'))->assertSessionHasErrors('email');
    $this->assertGuest();
});

it('consumes with one conditional update', function () {
    $user = User::factory()->create();
    $token = magicLinkToken(magicLinkFor($user));
    $updates = [];
    DB::listen(function ($query) use (&$updates): void {
        if (str_starts_with($query->sql, 'update "magic_links"')) {
            $updates[] = $query->sql;
        }
    });

    $first = resolve(ConsumeMagicLink::class)->handle($token);
    $second = resolve(ConsumeMagicLink::class)->handle($token);

    expect($first?->id)->toBe($user->id)
        ->and($second)->toBeNull()
        ->and($updates)->toHaveCount(2)
        ->and($updates[0])->toContain('"consumed_at" is null')->toContain('"expires_at" >');
});

it('expires after 15 minutes', function () {
    $user = User::factory()->create();
    $url = magicLinkFor($user);

    $this->travel(15)->minutes();
    $this->travel(1)->seconds();

    $this->get($url)->assertInertia(fn (Assert $page) => $page->where('confirmUrl', null));
    $this->post(consumeUrl($url))->assertRedirect(route('login'))->assertSessionHasErrors('email');
    $this->assertGuest();
});

it('a new link invalidates earlier ones', function () {
    $user = User::factory()->create();
    $first = magicLinkFor($user);
    $second = magicLinkFor($user);

    $this->post(consumeUrl($first))->assertRedirect(route('login'));
    $this->assertGuest();

    $this->post(consumeUrl($second))->assertRedirect(route('dashboard'));
    $this->assertAuthenticatedAs($user);
});

it('sends one mail per minute per address', function () {
    $user = User::factory()->create(['email' => 'known@example.test']);

    $this->post(route('magicLinks.store'), ['email' => $user->email]);
    $this->post(route('magicLinks.store'), ['email' => $user->email]);
    Mail::assertSentCount(1);

    $this->travel(61)->seconds();
    $this->post(route('magicLinks.store'), ['email' => $user->email]);
    Mail::assertSentCount(2);
});

it('the cooldown survives a change of case and spaces', function () {
    User::factory()->create(['email' => 'known@example.test']);

    $this->post(route('magicLinks.store'), ['email' => 'known@example.test']);
    $this->post(route('magicLinks.store'), ['email' => 'KNOWN@Example.Test']);

    Mail::assertSentCount(1);
});

it('stops at five an hour per address', function () {
    $user = User::factory()->create();

    foreach (range(1, 7) as $attempt) {
        $this->post(route('magicLinks.store'), ['email' => $user->email])->assertSessionHas('status', 'magic-link-sent');
        $this->travel(61)->seconds();
    }

    Mail::assertSentCount(5);
});

it('limits an IP that rotates addresses', function () {
    foreach (range(1, 10) as $attempt) {
        $this->post(route('magicLinks.store'), ['email' => "person{$attempt}@example.test"])->assertSessionHasNoErrors();
    }

    $this->from(route('login'))->post(route('magicLinks.store'), ['email' => 'person11@example.test'])
        ->assertRedirect(route('login'))
        ->assertSessionHasErrors('email');
});

it('refuses a malformed address', function (mixed $email) {
    Queue::fake();

    $this->post(route('magicLinks.store'), ['email' => $email])->assertSessionHasErrors('email');

    Queue::assertNothingPushed();
})->with(['', 'not-an-address', str_repeat('a', 250).'@example.test', [['a@example.test']]]);

it('regenerates the session', function () {
    $user = User::factory()->create();
    $url = magicLinkFor($user);
    $this->startSession();
    $before = session()->getId();

    $this->post(consumeUrl($url));

    expect(session()->getId())->not->toBe($before);
});

it('ignores a redirect parameter and honours the intended url kept by the server', function () {
    $user = User::factory()->create();

    $this->post(consumeUrl(magicLinkFor($user)).'?redirect=https://evil.test&next=https://evil.test', ['redirect' => 'https://evil.test'])
        ->assertRedirect(route('dashboard'));

    auth()->logout();
    $this->flushSession();

    $this->withSession(['url.intended' => url('/about')])
        ->post(consumeUrl(magicLinkFor($user)))
        ->assertRedirect(url('/about'));
});

it('sends an already signed-in person to the dashboard without consuming', function () {
    $user = User::factory()->create();
    $url = magicLinkFor($user);

    $this->actingAs(User::factory()->create())->get($url)->assertRedirect();

    expect(MagicLink::query()->sole()->consumed_at)->toBeNull();
});

it('writes the mail in the language of the account', function () {
    $user = User::factory()->create(['locale' => 'fr']);

    $this->post(route('magicLinks.store'), ['email' => $user->email]);

    Mail::assertSent(MagicLinkMail::class, fn (MagicLinkMail $mail): bool => $mail->locale === 'fr');
});

it('limits opening and confirming a link to twenty a minute for one address of origin', function () {
    $url = route('magicLinks.show', str_repeat('a', 64));

    foreach (range(1, 20) as $attempt) {
        $this->get($url)->assertOk();
    }

    $this->get($url)->assertTooManyRequests();
    $this->post(consumeUrl($url))->assertTooManyRequests();
});

it('previews the magic link mail', function () {
    $this->get('/dev/mail/magic-link')->assertOk()->assertSee('Sign in');
});
