<?php

namespace Tests\Browser\Support;

use Illuminate\Support\Sleep;
use InvalidArgumentException;
use RuntimeException;
use Symfony\Component\Process\Process;

class ReverbServer
{
    public const string Host = '127.0.0.1';

    public const int DefaultPort = 8097;

    public const string PortVariable = 'BROWSER_REVERB_PORT';

    public const string AppId = 'skrum-browser';

    public const string AppKey = 'skrum-browser-key';

    public const string AppSecret = 'skrum-browser-secret';

    private const int StartTimeoutSeconds = 15;

    private const int StopTimeoutSeconds = 5;

    private static ?Process $process = null;

    private static ?string $outputFile = null;

    private static bool $stopsAtShutdown = false;

    /**
     * Each run of the browser suite (and each shard of a sharded run) needs a port of its own.
     */
    public static function port(): int
    {
        $port = getenv(self::PortVariable);

        if ($port === false || $port === '') {
            return self::DefaultPort;
        }

        $variable = self::PortVariable;

        throw_unless(ctype_digit($port) && (int) $port >= 1 && (int) $port <= 65535, InvalidArgumentException::class, "{$variable} must be a port number between 1 and 65535, got `{$port}`.");

        return (int) $port;
    }

    /**
     * A listener this run did not start (a stale server with another app key, or an unrelated process)
     * fails the run at once instead of timing out the realtime assertions.
     */
    public static function ensureRunning(): void
    {
        if (self::$process !== null && self::isListening()) {
            return;
        }

        self::failOnForeignListener();

        self::start();
    }

    /**
     * The server writes to a file of its own: a child left attached to the
     * test runner's output pipes keeps `pest … | tail` from ever returning.
     */
    public static function start(): void
    {
        if (self::isListening()) {
            return;
        }

        $port = self::port();
        $host = self::Host;
        $outputFile = (string) tempnam(sys_get_temp_dir(), 'skrum-browser-reverb-');

        $process = Process::fromShellCommandline(
            'exec "${:REVERB_PHP_BINARY}" artisan reverb:start --host="${:REVERB_SERVER_HOST}" --port="${:REVERB_SERVER_PORT}" > "${:REVERB_OUTPUT_FILE}" 2>&1',
            base_path(),
            [
                'REVERB_PHP_BINARY' => PHP_BINARY,
                'REVERB_OUTPUT_FILE' => $outputFile,
                'REVERB_APP_ID' => self::AppId,
                'REVERB_APP_KEY' => self::AppKey,
                'REVERB_APP_SECRET' => self::AppSecret,
                'REVERB_SERVER_HOST' => $host,
                'REVERB_SERVER_PORT' => (string) $port,
                'REVERB_SCALING_ENABLED' => 'false',
                'REVERB_ALLOWED_ORIGINS' => '*',
            ],
        );
        $process->setTimeout(null);
        $process->disableOutput();
        $process->start();

        self::$process = $process;
        self::$outputFile = $outputFile;
        self::stopAtShutdown();

        $deadline = microtime(true) + self::StartTimeoutSeconds;

        while (microtime(true) < $deadline && $process->isRunning()) {
            if (self::isListening()) {
                return;
            }

            Sleep::usleep(100_000);
        }

        $output = trim((string) file_get_contents($outputFile));
        $seconds = self::StartTimeoutSeconds;

        self::stop();

        throw new RuntimeException("Reverb did not answer on {$host}:{$port} within {$seconds} seconds. Output of `php artisan reverb:start`:\n{$output}");
    }

    public static function stop(): void
    {
        if (self::$process === null) {
            self::failOnForeignListener();

            return;
        }

        self::$process->stop(self::StopTimeoutSeconds);
        self::$process = null;

        self::removeOutputFile();

        $deadline = microtime(true) + self::StopTimeoutSeconds;

        while (microtime(true) < $deadline && self::isListening()) {
            Sleep::usleep(100_000);
        }
    }

    private static function failOnForeignListener(): void
    {
        $port = self::port();

        throw_if(self::$process === null && self::isListening(), RuntimeException::class, "A Reverb server this test run did not start is listening on port {$port}. Stop that process and run the suite again.");
    }

    private static function isListening(): bool
    {
        $connection = @fsockopen(self::Host, self::port(), $errorCode, $errorMessage, 0.2);

        if ($connection === false) {
            return false;
        }

        fclose($connection);

        return true;
    }

    private static function removeOutputFile(): void
    {
        if (self::$outputFile === null) {
            return;
        }

        @unlink(self::$outputFile);

        self::$outputFile = null;
    }

    private static function stopAtShutdown(): void
    {
        if (self::$stopsAtShutdown) {
            return;
        }

        self::$stopsAtShutdown = true;

        register_shutdown_function(function (): void {
            if (self::$process !== null) {
                self::$process->stop(self::StopTimeoutSeconds);
            }

            self::removeOutputFile();
        });
    }
}
