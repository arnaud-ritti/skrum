@inject('instanceSettings', 'App\Support\InstanceSettings')
@inject('brandStyle', 'App\Support\Branding\BrandStyle')
@inject('brandAssets', 'App\Support\Branding\BrandAssets')
@php($brandCss = $brandStyle->css())
<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}" @class(['dark' => ($appearance ?? 'system') == 'dark', 'reduce-motion' => (bool) auth()->user()?->reduce_motion])>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <meta name="reverb-config" content="{{ json_encode(\App\Support\ReverbClientConfig::toArray()) }}">

        {{-- Inline script to detect system dark mode preference and apply it immediately --}}
        <script>
            (function() {
                const appearance = '{{ $appearance ?? "system" }}';

                if (appearance === 'system') {
                    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

                    if (prefersDark) {
                        document.documentElement.classList.add('dark');
                    }
                }
            })();
        </script>

        {{-- First-paint background: the values of --background in resources/css/app.css --}}
        <style>
            html {
                background-color: oklch(0.985 0.004 80);
            }

            html.dark {
                background-color: oklch(0.165 0.008 55);
            }
        </style>

        <link rel="icon" href="{{ $brandAssets->url('favicon') ?? '/favicon.svg' }}" type="{{ $brandAssets->mime('favicon') ?? 'image/svg+xml' }}">

        @viteReactRefresh
        @vite(['resources/css/app.css', 'resources/js/app.tsx', "resources/js/pages/{$page['component']}.tsx"])
@if($brandCss !== null)
        {{-- Printed raw because BrandStyle builds it from numbers only: no stored string reaches this tag --}}
        <style id="skrum-brand">{!! $brandCss !!}</style>
@endif
        <x-inertia::head>
            <title>{{ $instanceSettings->displayName() }}</title>
        </x-inertia::head>
    </head>
    <body>
        <x-inertia::app />
    </body>
</html>
