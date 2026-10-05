<?php

use Symfony\Component\Finder\Finder;

/**
 * @return array<int, string>
 */
function forbiddenBrowserTestCalls(string $directory): array
{
    if (! is_dir($directory)) {
        return [];
    }

    $forbiddenCalls = [
        'actingAs()' => '/\bactingAs\s*\(/i',
        'be()' => '/(?:->|::)\s*be\s*\(/i',
        'login()' => '/(?:->|::)\s*login\s*\(/i',
        'loginUsingId()' => '/\bloginUsingId\s*\(/i',
        'withCookie()' => '/\bwithCookies?\s*\(/i',
        'withUnencryptedCookie()' => '/\bwithUnencryptedCookies?\s*\(/i',
        'Event::fake() without arguments' => '/\bEvent\s*::\s*fake\s*\(\s*\)/i',
        'Event::fake([]) with an empty list' => '/\bEvent\s*::\s*fake\s*\(\s*(?:\[\s*\]|array\s*\(\s*\))\s*,?\s*\)/i',
        'Event::fakeExcept()' => '/\bEvent\s*::\s*fakeExcept\s*\(/i',
        'Event::fakeFor()' => '/\bEvent\s*::\s*fakeFor\s*\(/i',
    ];
    $offences = [];
    foreach (Finder::create()->files()->in($directory)->name('*.php') as $file) {
        $source = $file->getContents();

        foreach ($forbiddenCalls as $name => $pattern) {
            preg_match_all($pattern, $source, $matches, PREG_OFFSET_CAPTURE);

            foreach ($matches[0] as [, $offset]) {
                $lineNumber = substr_count($source, "\n", 0, $offset) + 1;
                $offences[] = "{$file->getPathname()}:{$lineNumber} calls {$name}";
            }
        }
    }

    sort($offences);

    return $offences;
}

it('keeps browser tests free of actingAs, injected cookies and a blanket event fake', function () {
    expect(forbiddenBrowserTestCalls(__DIR__.'/../Browser'))->toBeEmpty();
});

dataset('forbiddenBrowserTestForms', [
    'actingAs' => ['$this->actingAs($user);', 'actingAs()'],
    'actingAs followed by a space' => ['$this->actingAs ($user);', 'actingAs()'],
    'actingAs split over two lines' => ["\$this->actingAs\n    (\$user);", 'actingAs()'],
    'be' => ['$this->be($user);', 'be()'],
    'Auth::login' => ['Auth::login($user);', 'login()'],
    'auth()->login' => ['auth()->login($user);', 'login()'],
    'loginUsingId' => ['Auth::loginUsingId(1);', 'loginUsingId()'],
    'withCookie' => ['$this->withCookie("guest", "1|secret");', 'withCookie()'],
    'withCookies' => ['$this->withCookies(["guest" => "1|secret"]);', 'withCookie()'],
    'withUnencryptedCookie' => ['$this->withUnencryptedCookie("guest", "1|secret");', 'withUnencryptedCookie()'],
    'withUnencryptedCookies' => ['$this->withUnencryptedCookies(["guest" => "1|secret"]);', 'withUnencryptedCookie()'],
    'Event::fake' => ['Event::fake();', 'Event::fake() without arguments'],
    'Event::fake split over two lines' => ["Event::fake(\n);", 'Event::fake() without arguments'],
    'Event::fake with an empty list' => ['Event::fake([]);', 'Event::fake([]) with an empty list'],
    'Event::fake with a spaced empty list' => ['Event::fake( [ ] );', 'Event::fake([]) with an empty list'],
    'Event::fake with array()' => ['Event::fake(array());', 'Event::fake([]) with an empty list'],
    'Event::fakeExcept' => ['Event::fakeExcept([CardCreated::class]);', 'Event::fakeExcept()'],
    'Event::fakeFor' => ['Event::fakeFor(fn () => null);', 'Event::fakeFor()'],
]);

it('reports a forbidden call in a browser test', function (string $code, string $call) {
    $directory = sys_get_temp_dir().'/skrum-browser-rules-'.bin2hex(random_bytes(4));
    mkdir($directory);
    file_put_contents("{$directory}/CheatTest.php", "<?php\n\n{$code}\n");

    try {
        expect(forbiddenBrowserTestCalls($directory))->toBe(["{$directory}/CheatTest.php:3 calls {$call}"]);
    } finally {
        unlink("{$directory}/CheatTest.php");
        rmdir($directory);
    }
})->with('forbiddenBrowserTestForms');

it('allows a fake of named events and the calls that only look like a forbidden one', function () {
    $directory = sys_get_temp_dir().'/skrum-browser-rules-'.bin2hex(random_bytes(4));
    mkdir($directory);
    file_put_contents("{$directory}/HonestTest.php", "<?php\n\nEvent::fake([CardCreated::class]);\nexpect(\$count)->toBe(1);\n\$page = \$this->signIn(\$user);\n\$url = route('login');\n");

    try {
        expect(forbiddenBrowserTestCalls($directory))->toBeEmpty();
    } finally {
        unlink("{$directory}/HonestTest.php");
        rmdir($directory);
    }
});
