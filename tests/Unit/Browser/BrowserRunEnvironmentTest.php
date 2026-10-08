<?php

use Tests\Browser\Support\BrowserShard;
use Tests\Browser\Support\ReverbServer;

beforeEach(function () {
    $this->browserEnvironment = [
        ReverbServer::PortVariable => getenv(ReverbServer::PortVariable),
        BrowserShard::Variable => getenv(BrowserShard::Variable),
        BrowserShard::WorkerVariable => getenv(BrowserShard::WorkerVariable),
    ];

    foreach (array_keys($this->browserEnvironment) as $variable) {
        putenv($variable);
    }
});

afterEach(function () {
    foreach ($this->browserEnvironment as $variable => $value) {
        putenv($value === false ? $variable : "{$variable}={$value}");
    }
});

it('uses port 8097 for Reverb when no port is given', function (string $assignment) {
    putenv($assignment);

    expect(ReverbServer::port())->toBe(8097);
})->with([
    'variable unset' => ['BROWSER_REVERB_PORT'],
    'variable empty' => ['BROWSER_REVERB_PORT='],
]);

it('uses the Reverb port given by BROWSER_REVERB_PORT', function () {
    putenv('BROWSER_REVERB_PORT=8101');

    expect(ReverbServer::port())->toBe(8101);
});

it('refuses a Reverb port that is not a port number', function (string $port) {
    putenv("BROWSER_REVERB_PORT={$port}");

    expect(fn (): int => ReverbServer::port())->toThrow(InvalidArgumentException::class, 'BROWSER_REVERB_PORT');
})->with(['abc', '0', '70000', '80.5', '-1']);

it('is not a shard when BROWSER_SHARD is absent', function (string $assignment) {
    putenv($assignment);

    expect(BrowserShard::current())->toBeNull();
})->with([
    'variable unset' => ['BROWSER_SHARD'],
    'variable empty' => ['BROWSER_SHARD='],
]);

it('reads the shard number from BROWSER_SHARD', function () {
    putenv('BROWSER_SHARD=3');

    expect(BrowserShard::current())->toBe(3)
        ->and(BrowserShard::token(3))->toBe('browser_3');
});

it('isolates parallel browser workers with different shard numbers and Reverb ports', function () {
    putenv('TEST_TOKEN=1');

    expect(BrowserShard::current())->toBe(1)
        ->and(ReverbServer::port())->toBe(8098);

    putenv('TEST_TOKEN=2');

    expect(BrowserShard::current())->toBe(2)
        ->and(ReverbServer::port())->toBe(8099);
});

it('keeps an explicit shard and Reverb port ahead of the parallel worker defaults', function () {
    putenv('TEST_TOKEN=2');
    putenv('BROWSER_SHARD=3');
    putenv('BROWSER_REVERB_PORT=8105');

    expect(BrowserShard::current())->toBe(3)
        ->and(ReverbServer::port())->toBe(8105);
});

it('refuses a parallel worker that is not a positive integer', function (string $worker) {
    putenv("TEST_TOKEN={$worker}");

    expect(fn (): ?int => BrowserShard::current())->toThrow(InvalidArgumentException::class, 'TEST_TOKEN');
})->with(['abc', '0', '1/4']);

it('refuses a worker whose default Reverb port exceeds the valid range', function () {
    putenv('TEST_TOKEN=60000');

    expect(fn (): int => ReverbServer::port())->toThrow(InvalidArgumentException::class, 'BROWSER_REVERB_PORT');
});

it('refuses a shard that is not a positive integer', function (string $shard) {
    putenv("BROWSER_SHARD={$shard}");

    expect(fn (): ?int => BrowserShard::current())->toThrow(InvalidArgumentException::class, 'BROWSER_SHARD');
})->with(['abc', '0', '1/4']);
