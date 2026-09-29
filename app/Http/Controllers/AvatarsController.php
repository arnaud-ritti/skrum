<?php

namespace App\Http\Controllers;

use DiceBear\Avatar;
use DiceBear\Style;
use Illuminate\Http\Response;

class AvatarsController extends Controller
{
    private const DefaultStyle = 'thumbs';

    public function show(string $seed): Response
    {
        $style = $this->style();
        $definition = Style::fromJson((string) file_get_contents($this->stylePath($style)));
        $svg = (string) new Avatar($definition, ['seed' => $seed]);

        return response($svg, 200, [
            'Content-Type' => 'image/svg+xml',
            'Cache-Control' => 'public, max-age=31536000, immutable',
            'X-Content-Type-Options' => 'nosniff',
            'Content-Security-Policy' => "default-src 'none'; style-src 'unsafe-inline'",
        ]);
    }

    private function style(): string
    {
        $configured = (string) config('skrum.avatar_style');

        if (preg_match('/^[a-z0-9-]+$/', $configured) !== 1) {
            return self::DefaultStyle;
        }

        if (! is_file($this->stylePath($configured))) {
            return self::DefaultStyle;
        }

        return $configured;
    }

    private function stylePath(string $style): string
    {
        return base_path("vendor/dicebear/styles/src/{$style}.json");
    }
}
