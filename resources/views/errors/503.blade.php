{{--
    Static maintenance page: `php artisan down` and every other 503. A busy
    database (a deadlock or a lock wait that outlived its retries) keeps the
    page and swaps the maintenance wording for its own message, without the
    reload probe: the instance is up.
    In maintenance it shows when the instance is due back (`artisan down
    --retry`) and the message the admin prepared, both read from the
    maintenance payload, never from the database; the busy page shows neither.
    It reads no database, cache or session and loads no asset, so it cannot use
    app.css: its head and colours come from partials.static-page-head, shared
    with the status page. Its only script is inline: every 30 seconds it asks
    for the home route, a redirect that
    changes nothing, and reloads once the answer is no longer a 503. It does
    not ask for its own URL, which would run a one-time GET action twice, nor
    for /up, which Laravel keeps answering 200 in maintenance mode. It reloads
    rather than replaces: a URL with a fragment would only move the fragment.
--}}
@php
    $appearance = in_array(request()->cookie('appearance'), ['light', 'dark'], true) ? request()->cookie('appearance') : null;
    $instance = (string) config('app.name');
    // Maintenance mode answers before any route middleware: the locale is not set and its cookie is still encrypted.
    $locale = request()->route() === null && filled(request()->header('Accept-Language'))
        ? request()->getPreferredLanguage(array_unique([app()->getLocale(), ...config('skrum.locales')]))
        : app()->getLocale();
    $busyHeader = isset($exception) ? ($exception->getHeaders()[\App\Support\Database\Transactions::BusyHeader] ?? null) : null;
    $busyMessage = $busyHeader === null ? null : rawurldecode($busyHeader);
    $details = $busyMessage === null ? resolve(\App\Support\Maintenance\MaintenanceDetails::class)->read() : null;
    $backAt = $details['backAt'] ?? null;
    $message = $details['message'] ?? null;
    $author = $details['author'] ?? null;
    $authorInitials = $author === null ? '' : collect(preg_split('/\s+/u', trim($author)) ?: [])
        ->filter()
        ->take(2)
        ->map(fn (string $word): string => mb_strtoupper(mb_substr($word, 0, 1)))
        ->implode('');
@endphp
@include('partials.static-page-head', ['title' => ($busyMessage ?? __('Maintenance', [], $locale)).' - '.$instance])
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
            <a class="link" href="/status">{{ __('Instance status', [], $locale) }}</a>
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
            @if($busyMessage === null)
                <p class="overline">{{ __('Maintenance', [], $locale) }}</p>
                <h1>{{ __(':name is being updated', ['name' => $instance], $locale) }}</h1>
                <p class="description">{{ __('Nothing is lost: sessions pick up exactly where they stopped.', [], $locale) }}</p>
            @else
                <h1>{{ $busyMessage }}</h1>
            @endif
            @if($backAt !== null)
                <div class="back-at" data-slot="maintenance-back-at">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                        <circle cx="12" cy="12" r="10"/>
                        <path d="M12 6v6l4 2"/>
                    </svg>
                    <span class="back-at-text">
                        <span class="back-at-label">{{ __('Back at', [], $locale) }}</span>
                        <span class="back-at-time"><time datetime="{{ $backAt }}">{{ \Illuminate\Support\Carbon::parse($backAt)->utc()->format('H:i') }} UTC</time></span>
                        <span class="back-at-zone" data-slot="maintenance-back-at-zone" hidden
                              data-in-minutes="{{ __('your time (:zone) · in about :minutes min', [], $locale) }}"
                              data-soon="{{ __('Any moment now', [], $locale) }}"></span>
                    </span>
                </div>
            @endif
            @if($message !== null)
                <figure class="message" data-slot="maintenance-message">
                    <blockquote>{{ __('“:message”', ['message' => $message], $locale) }}</blockquote>
                    @if($author !== null)
                        <figcaption><span class="avatar" aria-hidden="true">{{ $authorInitials }}</span>{{ __(':name, instance admin', ['name' => $author], $locale) }}</figcaption>
                    @endif
                </figure>
            @endif
            <div class="actions">
                @if($busyMessage === null)
                    <span class="reload" data-slot="maintenance-reload" hidden>
                        <span class="trema" aria-hidden="true"><i></i><i></i></span>
                        <span>{{ __('This page reloads by itself as soon as the instance answers.', [], $locale) }}</span>
                    </span>
                @endif
                <a class="retry" href="/{{ ltrim(request()->getRequestUri(), '/') }}">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                        <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/>
                        <path d="M21 3v5h-5"/>
                        <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/>
                        <path d="M8 16H3v5"/>
                    </svg>
                    <span>{{ __('Retry now', [], $locale) }}</span>
                </a>
            </div>
        </main>
        <footer>
            {{ $instance }}
            {{-- Place left (AD-2): the version, after the name of the instance. --}}
        </footer>
        @if($busyMessage === null)
        <script>
            (function () {
                var wait = function () {
                    setTimeout(ask, 30000);
                };

                var ask = function () {
                    fetch('/', { method: 'HEAD', redirect: 'manual', cache: 'no-store', credentials: 'same-origin' }).then(function (answer) {
                        if (answer.status === 503) {
                            wait();

                            return;
                        }

                        location.reload();
                    }, wait);
                };

                var zone = document.querySelector('.back-at-zone');
                var time = document.querySelector('.back-at time');

                if (zone && time) {
                    var at = new Date(time.getAttribute('datetime'));
                    var lang = document.documentElement.lang;
                    var minutes = Math.round((at.getTime() - Date.now()) / 60000);
                    var zoneName = (new Intl.DateTimeFormat(lang, { timeZoneName: 'short' }).formatToParts(at).find(function (part) {
                        return part.type === 'timeZoneName';
                    }) || { value: '' }).value;

                    time.textContent = new Intl.DateTimeFormat(lang, { hour: 'numeric', minute: '2-digit' }).format(at);
                    zone.textContent = minutes > 0
                        ? zone.getAttribute('data-in-minutes').replace(':zone', zoneName).replace(':minutes', String(minutes))
                        : zone.getAttribute('data-soon');
                    zone.hidden = false;
                }

                document.querySelector('[data-slot="maintenance-reload"]').hidden = false;
                wait();
            })();
        </script>
        @endif
    </body>
</html>
