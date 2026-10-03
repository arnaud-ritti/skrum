{{--
    Public status page (spec §9.12), built from the frame of the static 503
    page: it is served outside the web group and during maintenance, reads the
    database only through the bounded checks of InstanceStatus, and loads no
    asset and no script.
--}}
@php
    use App\Enums\StatusComponentState as State;

    $appearance = in_array(request()->cookie('appearance'), ['light', 'dark'], true) ? request()->cookie('appearance') : null;
    $instance = (string) config('app.name');
    $heading = match ($overall) {
        'maintenance' => __('Maintenance in progress', [], $locale),
        'degraded' => __('Some systems are degraded', [], $locale),
        default => __('All systems operational', [], $locale),
    };
    $names = [
        'application' => __('Application', [], $locale),
        'database' => __('Database', [], $locale),
        'cache' => __('Cache', [], $locale),
        'queue' => __('Background jobs', [], $locale),
        'scheduler' => __('Scheduled tasks', [], $locale),
        'realtime' => __('Real time', [], $locale),
        'mail' => __('Email', [], $locale),
    ];
    $stateLabel = fn (State $state): string => match ($state) {
        State::Operational => __('Operational', [], $locale),
        State::Degraded => __('Degraded', [], $locale),
        State::Down => __('Unavailable', [], $locale),
        State::NotConfigured => __('Not configured', [], $locale),
        State::Maintenance => __('Maintenance', [], $locale),
    };
@endphp
@include('partials.static-page-head', ['title' => __('Instance status', [], $locale).' - '.$instance])
    <body data-slot="status-page">
        <header>
            <svg viewBox="0 0 64 64" width="22" height="22" role="img" aria-label="Skrüm">
                <path d="M14 0 H50 A14 14 0 0 1 64 14 V46 L46 64 H14 A14 14 0 0 1 0 50 V14 A14 14 0 0 1 14 0 Z" fill="var(--primary)"/>
                <path d="M64 46 L50 46 A4 4 0 0 0 46 50 L46 64 Z" fill="color-mix(in oklch, var(--primary) 70%, var(--foreground))"/>
                <path d="M19 27 L19 38 C19 45 24 49.5 30 49.5 C36 49.5 41 45 41 38 L41 27" fill="none" stroke="var(--primary-foreground)" stroke-width="7" stroke-linecap="round"/>
                <circle cx="21.5" cy="15.5" r="4.5" fill="var(--primary-foreground)"/>
                <circle cx="38.5" cy="15.5" r="4.5" fill="var(--primary-foreground)"/>
            </svg>
            <span class="word" aria-hidden="true">skrüm</span>
        </header>
        <main>
            <p class="overline">{{ __('Instance status', [], $locale) }}</p>
            <h1 data-slot="status-overall" data-overall="{{ $overall }}">{{ $heading }}</h1>
            <ul class="components">
                @foreach($components as $component)
                    <li class="component" data-slot="status-component" data-key="{{ $component['key'] }}" data-state="{{ $component['state']->value }}">
                        <span class="dot" aria-hidden="true">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                @switch($component['state'])
                                    @case(State::Operational)
                                        <circle cx="12" cy="12" r="10"/>
                                        <path d="m9 12 2 2 4-4"/>
                                        @break
                                    @case(State::Degraded)
                                        <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/>
                                        <path d="M12 9v4"/>
                                        <path d="M12 17h.01"/>
                                        @break
                                    @case(State::Down)
                                        <circle cx="12" cy="12" r="10"/>
                                        <path d="m15 9-6 6"/>
                                        <path d="m9 9 6 6"/>
                                        @break
                                    @case(State::NotConfigured)
                                        <circle cx="12" cy="12" r="10"/>
                                        <path d="M8 12h8"/>
                                        @break
                                    @case(State::Maintenance)
                                        <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
                                        @break
                                @endswitch
                            </svg>
                        </span>
                        <span class="name">{{ $names[$component['key']] }}</span>
                        <span class="state">{{ $stateLabel($component['state']) }}</span>
                    </li>
                @endforeach
            </ul>
            <p class="checked">{{ __('Checked at :time UTC', ['time' => $checkedAt], $locale) }}</p>
            <div class="actions">
                <a class="retry" href="/status">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                        <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/>
                        <path d="M21 3v5h-5"/>
                        <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/>
                        <path d="M8 16H3v5"/>
                    </svg>
                    <span>{{ __('Refresh', [], $locale) }}</span>
                </a>
                <a class="link" href="/">{{ __('Back to my teams', [], $locale) }}</a>
            </div>
        </main>
        <footer>
            {{ $instance }}
        </footer>
    </body>
</html>
