<?php

use App\Actions\Retros\BuildBoardSnapshot;
use App\Enums\InstanceSettingKey;
use App\Models\GamePlayer;
use App\Models\Participant;
use App\Models\PokerPlayer;
use App\Models\Retro;
use App\Models\User;
use App\Support\Avatars\AvatarStyleCatalogue;
use App\Support\Avatars\AvatarUrl;
use App\Support\InstanceSettings;
use Illuminate\Support\Facades\DB;

const StyledAvatarSeed = '5f2b8c1e9a4d47f0b3c6d8e1a7f90214';

beforeEach(function () {
    config(['skrum.avatar_style' => 'thumbs']);
});

function instanceSetting(InstanceSettingKey $key, mixed $value): void
{
    resolve(InstanceSettings::class)->set($key->value, $value);
}

it('uses the style of the environment when nothing is stored', function () {
    config(['skrum.avatar_style' => 'rings']);

    expect(resolve(AvatarUrl::class)->styleFor(null))->toBe('rings');
});

it('prefers the stored instance style to the environment', function () {
    config(['skrum.avatar_style' => 'rings']);
    instanceSetting(InstanceSettingKey::AvatarStyle, 'lorelei');

    expect(resolve(AvatarUrl::class)->styleFor(null))->toBe('lorelei');
});

it('uses the member style when members may choose', function () {
    instanceSetting(InstanceSettingKey::AvatarStyle, 'lorelei');
    instanceSetting(InstanceSettingKey::AvatarMemberChoice, true);

    expect(resolve(AvatarUrl::class)->styleFor('micah'))->toBe('micah')
        ->and(resolve(AvatarUrl::class)->styleFor(null))->toBe('lorelei');
});

it('ignores the member style when members may not choose', function () {
    instanceSetting(InstanceSettingKey::AvatarStyle, 'lorelei');
    instanceSetting(InstanceSettingKey::AvatarMemberChoice, false);
    $user = User::factory()->create(['avatar_style' => 'micah']);

    expect(resolve(AvatarUrl::class)->styleFor('micah'))->toBe('lorelei')
        ->and($user->avatarUrl())->toBe('/avatars/lorelei/'.$user->avatarSeed().'.svg')
        ->and($user->fresh()->avatar_style)->toBe('micah');
});

it('falls back when a style is unknown or cannot be selected', function (?string $environment, ?string $stored, ?string $member, string $expected) {
    config(['skrum.avatar_style' => $environment]);
    instanceSetting(InstanceSettingKey::AvatarStyle, $stored);
    instanceSetting(InstanceSettingKey::AvatarMemberChoice, true);

    expect(resolve(AvatarUrl::class)->styleFor($member))->toBe($expected);
})->with([
    'unknown environment style' => ['no-such-style', null, null, 'thumbs'],
    'environment style with a path' => ['../../etc/passwd', null, null, 'thumbs'],
    'no environment style' => [null, null, null, 'thumbs'],
    'unknown stored style' => ['rings', 'no-such-style', null, 'rings'],
    'stored style without licence data' => ['rings', 'blobs', null, 'rings'],
    'unknown member style' => ['rings', 'lorelei', 'no-such-style', 'lorelei'],
    'member style without licence data' => ['rings', 'lorelei', 'blobs', 'lorelei'],
]);

it('keeps the unversioned address while the style is the one of the environment', function () {
    $user = User::factory()->create();

    expect($user->avatarUrl())->toBe("/avatars/{$user->avatarSeed()}.svg");
});

it('changes the avatar address when the instance style changes', function () {
    $user = User::factory()->create();
    $guest = Participant::factory()->guest()->create();
    $before = $user->avatarUrl();

    instanceSetting(InstanceSettingKey::AvatarStyle, 'lorelei');

    expect($user->avatarUrl())->toBe("/avatars/lorelei/{$user->avatarSeed()}.svg")->not->toBe($before)
        ->and($guest->avatarUrl())->toBe("/avatars/lorelei/{$guest->avatarSeed()}.svg");

    instanceSetting(InstanceSettingKey::AvatarStyle, 'micah');

    expect($user->avatarUrl())->toBe("/avatars/micah/{$user->avatarSeed()}.svg");

    instanceSetting(InstanceSettingKey::AvatarStyle, null);

    expect($user->avatarUrl())->toBe($before);
});

it('changes the avatar address when a member changes their own style', function () {
    instanceSetting(InstanceSettingKey::AvatarMemberChoice, true);
    $user = User::factory()->create();
    $before = $user->avatarUrl();

    $user->update(['avatar_style' => 'micah']);

    expect($user->avatarUrl())->toBe("/avatars/micah/{$user->avatarSeed()}.svg")->not->toBe($before);

    $user->update(['avatar_style' => 'lorelei']);

    expect($user->avatarUrl())->toBe("/avatars/lorelei/{$user->avatarSeed()}.svg");
});

it('gives a member the same avatar as a user, a participant and a player', function () {
    instanceSetting(InstanceSettingKey::AvatarMemberChoice, true);
    $user = User::factory()->create(['avatar_style' => 'micah']);
    $participant = Participant::factory()->create(['user_id' => $user->id]);
    $pokerPlayer = PokerPlayer::factory()->create(['user_id' => $user->id]);
    $gamePlayer = GamePlayer::factory()->forParticipant($participant)->create();

    expect($participant->avatarUrl())->toBe($user->avatarUrl())
        ->and($pokerPlayer->avatarUrl())->toBe($user->avatarUrl())
        ->and($gamePlayer->avatarUrl())->toBe($user->avatarUrl())
        ->and($user->avatarUrl())->toContain('/avatars/micah/');
});

it('gives guests the instance style even when members may choose', function () {
    instanceSetting(InstanceSettingKey::AvatarStyle, 'lorelei');
    instanceSetting(InstanceSettingKey::AvatarMemberChoice, true);
    $guest = Participant::factory()->guest()->create();

    expect($guest->avatarUrl())->toBe("/avatars/lorelei/{$guest->avatarSeed()}.svg");
});

it('still answers the unversioned address with the style of the environment', function () {
    instanceSetting(InstanceSettingKey::AvatarStyle, 'lorelei');

    $unversioned = $this->get('/avatars/'.StyledAvatarSeed.'.svg')
        ->assertOk()
        ->assertHeader('Content-Type', 'image/svg+xml')
        ->getContent();

    $styled = $this->get('/avatars/lorelei/'.StyledAvatarSeed.'.svg')->assertOk()->getContent();

    expect($unversioned)->toContain('<dc:title>Thumbs</dc:title>')
        ->and($styled)->toContain('<dc:title>Lorelei</dc:title>');
});

it('serves a styled avatar with safe, cacheable headers and no cookie', function () {
    $response = $this->get('/avatars/micah/'.StyledAvatarSeed.'.svg')
        ->assertOk()
        ->assertHeader('Content-Type', 'image/svg+xml')
        ->assertHeader('Cache-Control', 'immutable, max-age=31536000, public')
        ->assertHeader('X-Content-Type-Options', 'nosniff')
        ->assertHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; form-action 'none'; sandbox");

    expect($response->getContent())->toStartWith('<svg')
        ->and($response->headers->getCookies())->toBe([]);
});

it('refuses a style that is not selectable', function (string $style) {
    $this->get("/avatars/{$style}/".StyledAvatarSeed.'.svg')->assertNotFound();
})->with([
    'unknown' => ['no-such-style'],
    'without licence data' => ['blobs'],
    'parent directory' => ['..'],
    'encoded traversal' => ['..%2F..%2Fcomposer'],
    'nested path' => ['thumbs/thumbs'],
    'dotted name' => ['thumbs.json'],
    'upper case' => ['Thumbs'],
]);

it('refuses a malformed seed on the styled address', function (string $seed) {
    $this->get("/avatars/micah/{$seed}.svg")->assertNotFound();
})->with(['short', str_repeat('Z', 32), str_repeat('a', 33)]);

it('offers only installed styles with a known licence', function () {
    $catalogue = resolve(AvatarStyleCatalogue::class);

    expect($catalogue->selectable())->toContain('thumbs', 'micah', 'initials')
        ->not->toContain('blobs')
        ->and($catalogue->values())->toContain('blobs')
        ->and(array_column($catalogue->styles(), 'value'))->toBe($catalogue->selectable())
        ->and(array_column($catalogue->styles(), 'attribution'))->not->toContain(null);
});

it('links the initials style to a drawing of the initials of the name', function () {
    instanceSetting(InstanceSettingKey::AvatarStyle, 'initials');
    $user = User::factory()->create(['name' => 'élodie de la Tour']);
    $guest = Participant::factory()->guest()->create(['guest_name' => 'Zed']);

    expect($user->avatarUrl())->toBe("/avatars/initials/{$user->avatarSeed()}.svg?n=".rawurlencode('ÉT'))
        ->and($guest->avatarUrl())->toBe("/avatars/initials/{$guest->avatarSeed()}.svg?n=Z");

    $svg = $this->get($user->avatarUrl())
        ->assertOk()
        ->assertHeader('Content-Type', 'image/svg+xml')
        ->assertHeader('X-Content-Type-Options', 'nosniff')
        ->assertHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; form-action 'none'; sandbox")
        ->getContent();

    expect($svg)->toContain('>ÉT</text>');
});

it('draws nothing for initials that are not one or two letters or digits', function (string $query) {
    $svg = $this->get('/avatars/initials/'.StyledAvatarSeed.".svg{$query}")->assertOk()->getContent();

    expect($svg)->toStartWith('<svg')
        ->not->toContain('<script')
        ->not->toContain('ABC')
        ->not->toContain('</text>');
})->with([
    'markup' => ['?n='.'%3Cscript%3E'],
    'too long' => ['?n=ABC'],
    'array' => ['?n[]=A'],
    'missing' => [''],
    'punctuation' => ['?n=%22%3E'],
]);

it('builds the board snapshot with a constant number of queries when members chose styles', function () {
    instanceSetting(InstanceSettingKey::AvatarMemberChoice, true);
    $retro = Retro::factory()->create();
    [, $viewer] = retroMember($retro);
    $seed = function (int $members) use ($retro): void {
        foreach (range(1, $members) as $index) {
            [$user] = retroMember($retro);
            $user->update(['avatar_style' => 'micah']);
        }
    };
    $countQueries = function () use ($retro, $viewer): int {
        $fresh = $retro->fresh();
        $freshViewer = $viewer->fresh();

        DB::flushQueryLog();
        DB::enableQueryLog();
        $snapshot = resolve(BuildBoardSnapshot::class)->handle($fresh, $freshViewer);
        DB::disableQueryLog();

        expect(json_encode($snapshot))->toContain('avatars\/micah\/');

        return count(DB::getQueryLog());
    };

    $seed(2);
    warmInstanceSettings();
    $small = $countQueries();

    $seed(6);

    expect($countQueries())->toBe($small);
});
