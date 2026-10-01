<?php

use App\Enums\IntegrationProvider;
use App\Rules\OutgoingWebhookUrl;
use App\Support\Integrations\Exceptions\UnsafeWebhookUrl;
use App\Support\Integrations\HostResolver;
use App\Support\Integrations\Webhook\SafeWebhookUrl;
use App\Support\Integrations\Webhook\WebhookTarget;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Validator;
use Mockery\MockInterface;

beforeEach(function () {
    Http::preventStrayRequests();
    enableIntegrations(IntegrationProvider::Webhook);
});

it('enables outgoing webhooks with their env flag', function () {
    expect(IntegrationProvider::Webhook->isEnabled())->toBeTrue();

    config(['services.outgoing_webhooks.enabled' => false]);

    expect(IntegrationProvider::Webhook->isEnabled())->toBeFalse();
});

it('accepts public endpoints', function (string $url, array $addresses, string $host, int $port) {
    outgoingWebhookResolves($addresses);

    $target = app(SafeWebhookUrl::class)->resolve($url);

    expect($target->url)->toBe($url)
        ->and($target->host)->toBe($host)
        ->and($target->port)->toBe($port)
        ->and($target->address)->toBe($addresses[0]);
})->with([
    'https' => ['https://hooks.example.com/skrum', ['93.184.216.34'], 'hooks.example.com', 443],
    'high port' => ['https://hooks.example.com:8443/skrum', ['93.184.216.34'], 'hooks.example.com', 8443],
    'upper-case host' => ['https://Hooks.Example.com/skrum', ['93.184.216.34'], 'hooks.example.com', 443],
    'public v6' => ['https://hooks.example.com/skrum', ['2606:2800:220:1:248:1893:25c8:1946'], 'hooks.example.com', 443],
]);

it('refuses private, reserved and invalid endpoints', function (string $url, array $addresses) {
    outgoingWebhookResolves($addresses);

    expect(fn () => app(SafeWebhookUrl::class)->resolve($url))->toThrow(UnsafeWebhookUrl::class);
})->with([
    'plain http' => ['http://hooks.example.com/skrum', ['93.184.216.34']],
    'ftp' => ['ftp://hooks.example.com/skrum', ['93.184.216.34']],
    'user info' => ['https://user:pass@hooks.example.com/skrum', ['93.184.216.34']],
    'port 22' => ['https://hooks.example.com:22/skrum', ['93.184.216.34']],
    'port 1023' => ['https://hooks.example.com:1023/skrum', ['93.184.216.34']],
    'not a url' => ['hooks.example.com/skrum', ['93.184.216.34']],
    'unresolvable' => ['https://nowhere.example.com/skrum', []],
    'loopback' => ['https://hooks.example.com/skrum', ['127.0.0.1']],
    'rfc 1918 (10/8)' => ['https://hooks.example.com/skrum', ['10.1.2.3']],
    'rfc 1918 (172.16/12)' => ['https://hooks.example.com/skrum', ['172.16.5.4']],
    'rfc 1918 (192.168/16)' => ['https://hooks.example.com/skrum', ['192.168.1.10']],
    'cloud metadata' => ['https://hooks.example.com/skrum', ['169.254.169.254']],
    'cgnat' => ['https://hooks.example.com/skrum', ['100.64.0.1']],
    'this network' => ['https://hooks.example.com/skrum', ['0.0.0.0']],
    'multicast' => ['https://hooks.example.com/skrum', ['224.0.0.1']],
    'loopback v6' => ['https://hooks.example.com/skrum', ['::1']],
    'unique local v6' => ['https://hooks.example.com/skrum', ['fc00::1']],
    'link-local v6' => ['https://hooks.example.com/skrum', ['fe80::1']],
    'one private record among public ones' => ['https://hooks.example.com/skrum', ['93.184.216.34', '10.0.0.1']],
]);

it('refuses IP literals without resolving them', function () {
    $this->mock(HostResolver::class, fn (MockInterface $mock) => $mock->shouldNotReceive('addresses'));

    expect(fn () => app(SafeWebhookUrl::class)->resolve('https://127.0.0.1/skrum'))->toThrow(UnsafeWebhookUrl::class)
        ->and(fn () => app(SafeWebhookUrl::class)->resolve('https://169.254.169.254/latest/meta-data'))->toThrow(UnsafeWebhookUrl::class)
        ->and(app(SafeWebhookUrl::class)->resolve('https://93.184.216.34/skrum')->pinnedResolve())->toBeNull();
});

it('allows plain http and private networks only when the instance does', function () {
    outgoingWebhookResolves(['10.0.0.5']);
    config([
        'services.outgoing_webhooks.allow_http' => true,
        'services.outgoing_webhooks.allow_private_networks' => true,
    ]);

    $target = app(SafeWebhookUrl::class)->resolve('http://ci.internal:8080/hooks');

    expect($target->port)->toBe(8080)
        ->and($target->address)->toBe('10.0.0.5')
        ->and(SafeWebhookUrl::hasAllowedShape('http://ci.internal/hooks'))->toBeTrue();

    config(['services.outgoing_webhooks.allow_http' => false]);

    expect(SafeWebhookUrl::hasAllowedShape('http://ci.internal/hooks'))->toBeFalse()
        ->and(SafeWebhookUrl::hasAllowedShape('https://ci.internal/hooks'))->toBeTrue();
});

it('pins IPv4 and IPv6 addresses for curl', function () {
    expect((new WebhookTarget('https://hooks.example.com/x', 'hooks.example.com', 443, '93.184.216.34'))->pinnedResolve())
        ->toBe('hooks.example.com:443:93.184.216.34')
        ->and((new WebhookTarget('https://hooks.example.com:8443/x', 'hooks.example.com', 8443, '2606:2800::1'))->pinnedResolve())
        ->toBe('hooks.example.com:8443:[2606:2800::1]');
});

it('validates webhook URLs with a single message', function () {
    outgoingWebhookResolves(['192.168.1.10']);

    $validator = Validator::make(['url' => 'https://hooks.example.com/x'], ['url' => [new OutgoingWebhookUrl]]);

    expect($validator->fails())->toBeTrue()
        ->and($validator->errors()->first('url'))->toBe('This URL points to a private or invalid address.');

    outgoingWebhookResolves();

    expect(Validator::make(['url' => 'https://hooks.example.com/x'], ['url' => [new OutgoingWebhookUrl]])->passes())->toBeTrue();
});
