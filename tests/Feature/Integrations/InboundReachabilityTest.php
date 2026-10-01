<?php

use App\Support\Integrations\HostResolver;
use App\Support\Integrations\InboundReachability;
use App\Support\Integrations\PublicAddress;
use Illuminate\Support\Facades\Http;
use Mockery\MockInterface;

beforeEach(fn () => Http::preventStrayRequests());

/**
 * @param  array<int, string>  $addresses
 */
function fakePublicResolver(array $addresses, int $times = 1): void
{
    test()->mock(HostResolver::class, fn (MockInterface $mock) => $mock
        ->shouldReceive('addresses')
        ->times($times)
        ->andReturn($addresses));
}

it('tells public addresses from private and reserved ones', function (string $address, bool $public) {
    expect(PublicAddress::isPublic($address))->toBe($public);
})->with([
    'public v4' => ['93.184.216.34', true],
    'public dns' => ['8.8.8.8', true],
    'public v6' => ['2606:4700:4700::1111', true],
    'loopback' => ['127.0.0.1', false],
    'rfc1918 10' => ['10.1.2.3', false],
    'rfc1918 172' => ['172.16.5.4', false],
    'rfc1918 192' => ['192.168.1.1', false],
    'metadata' => ['169.254.169.254', false],
    'cgnat' => ['100.64.0.1', false],
    'this network' => ['0.0.0.0', false],
    'multicast' => ['224.0.0.1', false],
    'broadcast' => ['255.255.255.255', false],
    'v6 loopback' => ['::1', false],
    'v6 ula' => ['fd12:3456::1', false],
    'v6 link local' => ['fe80::1', false],
    'v6 multicast' => ['ff02::1', false],
    'v4 mapped' => ['::ffff:127.0.0.1', false],
    'not an address' => ['example.com', false],
]);

it('matches CIDR ranges on bit boundaries', function () {
    expect(PublicAddress::inRange('100.127.255.255', '100.64.0.0/10'))->toBeTrue()
        ->and(PublicAddress::inRange('100.128.0.0', '100.64.0.0/10'))->toBeFalse()
        ->and(PublicAddress::inRange('fc00::1', 'fc00::/7'))->toBeTrue()
        ->and(PublicAddress::inRange('fe00::1', 'fc00::/7'))->toBeFalse()
        ->and(PublicAddress::inRange('10.0.0.1', 'fc00::/7'))->toBeFalse();
});

it('follows the forced modes whatever APP_URL is', function () {
    config(['app.url' => 'http://localhost']);
    fakePublicResolver([], times: 0);

    config(['services.integrations.inbound_webhooks' => 'on']);
    expect(app(InboundReachability::class)->isPublic())->toBeTrue();

    config(['services.integrations.inbound_webhooks' => 'off', 'app.url' => 'https://skrum.example.com']);
    expect(app(InboundReachability::class)->isPublic())->toBeFalse();
});

it('treats an https host resolving to a public address as public', function () {
    config(['services.integrations.inbound_webhooks' => 'auto', 'app.url' => 'https://skrum.example.com']);
    fakePublicResolver(['10.0.0.5', '93.184.216.34']);

    expect(app(InboundReachability::class)->isPublic())->toBeTrue();
});

it('treats local or private APP_URLs as not public', function (string $url, array $addresses, int $lookups) {
    config(['services.integrations.inbound_webhooks' => 'auto', 'app.url' => $url]);
    fakePublicResolver($addresses, $lookups);

    expect(app(InboundReachability::class)->isPublic())->toBeFalse();
})->with([
    'http' => ['http://skrum.example.com', ['93.184.216.34'], 0],
    'localhost' => ['https://localhost', ['127.0.0.1'], 0],
    'ip literal' => ['https://203.0.113.10', ['203.0.113.10'], 0],
    'ipv6 literal' => ['https://[2606:4700:4700::1111]', ['2606:4700:4700::1111'], 0],
    '.test' => ['https://skrum.test', ['93.184.216.34'], 0],
    '.local' => ['https://skrum.local', ['93.184.216.34'], 0],
    '.localhost' => ['https://app.localhost', ['93.184.216.34'], 0],
    '.internal' => ['https://skrum.corp.internal', ['93.184.216.34'], 0],
    '.lan' => ['https://skrum.lan', ['93.184.216.34'], 0],
    '.home.arpa' => ['https://skrum.home.arpa', ['93.184.216.34'], 0],
    'private only' => ['https://skrum.example.com', ['10.0.0.5', 'fd00::5'], 1],
    'unresolvable' => ['https://skrum.example.com', [], 1],
]);

it('caches the answer for an hour', function () {
    config(['services.integrations.inbound_webhooks' => 'auto', 'app.url' => 'https://skrum.example.com']);
    fakePublicResolver(['93.184.216.34'], times: 2);

    expect(app(InboundReachability::class)->isPublic())->toBeTrue()
        ->and(app(InboundReachability::class)->isPublic())->toBeTrue();

    $this->travel(61)->minutes();

    expect(app(InboundReachability::class)->isPublic())->toBeTrue();
});

it('falls back to auto for an unknown mode and clamps the poll interval', function () {
    config(['services.integrations.inbound_webhooks' => 'sometimes']);

    expect(InboundReachability::mode())->toBe('auto');

    foreach ([[0, 1], [5, 5], [60, 60], [90, 60], [-3, 1]] as [$configured, $expected]) {
        config(['services.integrations.poll_minutes' => $configured]);

        expect(InboundReachability::pollIntervalMinutes())->toBe($expected);
    }
});
