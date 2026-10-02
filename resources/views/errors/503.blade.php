{{--
    Static maintenance page: `php artisan down` and every other 503.
    It reads no database, cache or session and loads no script and no asset, so
    it cannot use app.css: the colours below are copied from
    docs/design-system/tokens.json (light theme, then dark). This file is
    outside the token rule of the front end for that reason.
--}}
@php
    $appearance = in_array(request()->cookie('appearance'), ['light', 'dark'], true) ? request()->cookie('appearance') : null;
    $instance = (string) config('app.name');
@endphp
<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}" @class([$appearance => $appearance !== null])>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <meta name="robots" content="noindex">
        <title>{{ __('Maintenance') }} - {{ $instance }}</title>
        <style>
            :root {
                color-scheme: light;
                --background: oklch(0.985 0.004 80);
                --foreground: oklch(0.225 0.014 50);
                --card: oklch(1 0 0);
                --primary: oklch(0.560 0.150 38);
                --primary-foreground: oklch(0.990 0.005 80);
                --primary-text: oklch(0.480 0.140 38);
                --muted: oklch(0.955 0.007 75);
                --muted-foreground: oklch(0.480 0.016 55);
                --accent: oklch(0.950 0.025 50);
                --input: oklch(0.640 0.016 60);
                --sky: oklch(0.955 0.024 240);
                --sky-border: oklch(0.820 0.090 240);
                --sky-text: oklch(0.420 0.099 240);
            }

            @media (prefers-color-scheme: dark) {
                :root:not(.light) {
                    color-scheme: dark;
                    --background: oklch(0.165 0.008 55);
                    --foreground: oklch(0.955 0.006 80);
                    --card: oklch(0.205 0.009 55);
                    --primary: oklch(0.720 0.135 42);
                    --primary-foreground: oklch(0.190 0.025 40);
                    --primary-text: oklch(0.800 0.110 45);
                    --muted: oklch(0.255 0.010 55);
                    --muted-foreground: oklch(0.740 0.012 70);
                    --accent: oklch(0.290 0.030 45);
                    --input: oklch(0.520 0.014 60);
                    --sky: oklch(0.275 0.050 240);
                    --sky-border: oklch(0.440 0.080 240);
                    --sky-text: oklch(0.870 0.071 240);
                }
            }

            :root.dark {
                color-scheme: dark;
                --background: oklch(0.165 0.008 55);
                --foreground: oklch(0.955 0.006 80);
                --card: oklch(0.205 0.009 55);
                --primary: oklch(0.720 0.135 42);
                --primary-foreground: oklch(0.190 0.025 40);
                --primary-text: oklch(0.800 0.110 45);
                --muted: oklch(0.255 0.010 55);
                --muted-foreground: oklch(0.740 0.012 70);
                --accent: oklch(0.290 0.030 45);
                --input: oklch(0.520 0.014 60);
                --sky: oklch(0.275 0.050 240);
                --sky-border: oklch(0.440 0.080 240);
                --sky-text: oklch(0.870 0.071 240);
            }

            *, *::before, *::after {
                box-sizing: border-box;
            }

            html {
                font-family: "Figtree", ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
                background: var(--background);
                color: var(--foreground);
                -webkit-text-size-adjust: 100%;
            }

            body {
                margin: 0;
                min-height: 100svh;
                display: flex;
                flex-direction: column;
                gap: 1rem;
                padding: 1rem;
            }

            header {
                display: flex;
                align-items: center;
                gap: 0.5rem;
            }

            .word {
                font-family: "Bricolage Grotesque", "Figtree", ui-sans-serif, system-ui, sans-serif;
                font-size: 1.0625rem;
                font-weight: 700;
                letter-spacing: -0.03em;
            }

            main {
                flex: 1;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                gap: 0.75rem;
                width: 100%;
                max-width: 31rem;
                margin: 0 auto;
                text-align: center;
            }

            .art {
                width: 10rem;
                height: 6.875rem;
                margin-bottom: 0.25rem;
            }

            .overline {
                margin: 0;
                font-size: 0.6875rem;
                line-height: 1rem;
                font-weight: 650;
                letter-spacing: 0.08em;
                text-transform: uppercase;
                color: var(--primary-text);
            }

            h1 {
                margin: 0;
                font-family: "Bricolage Grotesque", "Figtree", ui-sans-serif, system-ui, sans-serif;
                font-size: 1.25rem;
                line-height: 1.75rem;
                font-weight: 650;
                letter-spacing: -0.01em;
                text-wrap: balance;
                overflow-wrap: anywhere;
            }

            .description {
                margin: 0;
                font-size: 0.875rem;
                line-height: 1.375rem;
                color: var(--muted-foreground);
                text-wrap: pretty;
            }

            .retry {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                gap: 0.5rem;
                height: 2rem;
                margin-top: 0.25rem;
                padding: 0 0.75rem 0 0.625rem;
                border: 1px solid var(--input);
                border-radius: 0.5rem;
                background: var(--card);
                color: var(--foreground);
                font-size: 0.875rem;
                font-weight: 500;
                text-decoration: none;
                white-space: nowrap;
            }

            .retry:hover {
                background: var(--accent);
            }

            .retry:focus-visible {
                outline: 2px solid var(--primary);
                outline-offset: 2px;
            }

            .retry svg {
                width: 1rem;
                height: 1rem;
                flex: none;
            }

            footer {
                min-height: 1rem;
                font-size: 0.75rem;
                color: var(--muted-foreground);
                text-align: center;
            }

            @media (min-width: 48rem) {
                body {
                    padding: 1rem 1.5rem;
                }
            }

            @media (max-width: 39.999rem) {
                .retry {
                    width: 100%;
                    height: 2.75rem;
                }
            }
        </style>
    </head>
    <body data-slot="maintenance-page">
        <header>
            <svg viewBox="0 0 64 64" width="22" height="22" role="img" aria-label="Skrüm">
                <path d="M14 0 H50 A14 14 0 0 1 64 14 V46 L46 64 H14 A14 14 0 0 1 0 50 V14 A14 14 0 0 1 14 0 Z" fill="var(--primary)"/>
                <path d="M64 46 L50 46 A4 4 0 0 0 46 50 L46 64 Z" fill="color-mix(in oklch, var(--primary) 70%, var(--foreground))"/>
                <path d="M19 27 L19 38 C19 45 24 49.5 30 49.5 C36 49.5 41 45 41 38 L41 27" fill="none" stroke="var(--primary-foreground)" stroke-width="7" stroke-linecap="round"/>
                <circle cx="21.5" cy="15.5" r="4.5" fill="var(--primary-foreground)"/>
                <circle cx="38.5" cy="15.5" r="4.5" fill="var(--primary-foreground)"/>
            </svg>
            <span class="word" aria-hidden="true">skrüm</span>
            {{-- Place left (AD-3): the "Instance status" link, at the end of the header. --}}
        </header>
        <main>
            <svg class="art" viewBox="0 0 160 110" aria-hidden="true">
                <circle cx="72" cy="10" r="4" fill="var(--primary)"/>
                <circle cx="88" cy="10" r="4" fill="var(--primary)"/>
                <path d="M46 22 H114 V84 L104 94 H46 Z" fill="var(--sky)" stroke="var(--sky-border)" stroke-width="1.2"/>
                <path d="M114 84 H106 A2 2 0 0 0 104 86 V94 Z" fill="var(--sky-border)"/>
                <circle cx="80" cy="56" r="22" fill="var(--card)" stroke="var(--sky-text)" stroke-width="2"/>
                <path d="M80 42 V56 L90 62" fill="none" stroke="var(--primary)" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>
                <circle cx="80" cy="56" r="2.5" fill="var(--sky-text)"/>
                <ellipse cx="80" cy="103" rx="44" ry="4" fill="var(--muted)"/>
            </svg>
            <p class="overline">{{ __('Maintenance') }}</p>
            <h1>{{ __(':name is being updated', ['name' => $instance]) }}</h1>
            <p class="description">{{ __('Nothing is lost: sessions pick up exactly where they stopped.') }}</p>
            {{-- Place left (AD-5): the "Back at" block, then the message of the instance admin. --}}
            <a class="retry" href="{{ request()->getRequestUri() }}">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/>
                    <path d="M21 3v5h-5"/>
                    <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/>
                    <path d="M8 16H3v5"/>
                </svg>
                <span>{{ __('Retry now') }}</span>
            </a>
        </main>
        <footer>
            {{ $instance }}
            {{-- Place left (AD-2): the version, after the name of the instance. --}}
        </footer>
    </body>
</html>
