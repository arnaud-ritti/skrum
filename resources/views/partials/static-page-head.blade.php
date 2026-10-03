{{--
    The head shared by the static pages that read no database and load no
    asset: the 503 page and the status page. It opens the document; the page
    writes its body and closes the html element. The colours are copied from
    docs/design-system/tokens.json (light theme, then dark), outside the token
    rule of the front end for that reason.
--}}
<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', $locale) }}" @class([$appearance => $appearance !== null])>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <meta name="robots" content="noindex">
        <title>{{ $title }}</title>
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
                --success-text: oklch(0.400 0.085 165);
                --warning-text: oklch(0.450 0.100 60);
                --destructive-text: oklch(0.470 0.170 20);
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
                    --success-text: oklch(0.850 0.090 165);
                    --warning-text: oklch(0.860 0.110 85);
                    --destructive-text: oklch(0.820 0.100 20);
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
                --success-text: oklch(0.850 0.090 165);
                --warning-text: oklch(0.860 0.110 85);
                --destructive-text: oklch(0.820 0.100 20);
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

            .actions {
                display: flex;
                flex-wrap: wrap;
                align-items: center;
                justify-content: center;
                gap: 0.5rem;
                margin-top: 0.25rem;
            }

            .reload {
                display: inline-flex;
                align-items: center;
                gap: 0.5rem;
                font-size: 0.75rem;
                line-height: 1rem;
                color: var(--muted-foreground);
                text-align: left;
            }

            .reload[hidden] {
                display: none;
            }

            .trema {
                display: inline-flex;
                align-items: center;
                gap: 0.1875rem;
                flex: none;
                color: var(--primary);
            }

            .trema i {
                display: block;
                width: 0.3125rem;
                height: 0.3125rem;
                border-radius: 50%;
                background: currentColor;
                animation: trema 1s cubic-bezier(0.2, 0, 0, 1) infinite;
            }

            .trema i:nth-child(2) {
                animation-delay: 0.18s;
            }

            @keyframes trema {
                0%, 100% {
                    transform: translateY(0);
                    opacity: 1;
                }

                40% {
                    transform: translateY(-0.25rem);
                    opacity: 0.6;
                }
            }

            @media (prefers-reduced-motion: reduce) {
                .trema i {
                    animation: none;
                }
            }

            .retry {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                gap: 0.5rem;
                height: 2rem;
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

            .components {
                width: 100%;
                margin: 0.5rem 0 0;
                padding: 0;
                list-style: none;
                border: 1px solid var(--input);
                border-radius: 0.75rem;
                background: var(--card);
                text-align: left;
            }

            .component {
                display: flex;
                align-items: center;
                gap: 0.75rem;
                padding: 0.625rem 0.875rem;
                font-size: 0.875rem;
                line-height: 1.25rem;
            }

            .component + .component {
                border-top: 1px solid var(--muted);
            }

            .component .name {
                flex: 1;
                min-width: 0;
                overflow-wrap: anywhere;
            }

            .component .state {
                font-weight: 500;
                white-space: nowrap;
            }

            .dot {
                display: inline-flex;
                width: 1rem;
                height: 1rem;
                flex: none;
            }

            .dot svg {
                width: 1rem;
                height: 1rem;
            }

            [data-state="operational"] .dot,
            [data-state="operational"] .state {
                color: var(--success-text);
            }

            [data-state="degraded"] .dot,
            [data-state="degraded"] .state,
            [data-state="maintenance"] .dot,
            [data-state="maintenance"] .state {
                color: var(--warning-text);
            }

            [data-state="down"] .dot,
            [data-state="down"] .state {
                color: var(--destructive-text);
            }

            [data-state="not_configured"] .dot,
            [data-state="not_configured"] .state {
                color: var(--muted-foreground);
            }

            .checked {
                margin: 0;
                font-size: 0.75rem;
                line-height: 1rem;
                color: var(--muted-foreground);
            }

            .link {
                color: var(--primary-text);
                font-size: 0.875rem;
                font-weight: 500;
                text-decoration: underline;
                text-underline-offset: 0.1875rem;
            }

            .link:focus-visible {
                outline: 2px solid var(--primary);
                outline-offset: 2px;
                border-radius: 0.25rem;
            }

            header .link {
                margin-left: auto;
                font-size: 0.75rem;
                line-height: 1rem;
            }

            .back-at {
                display: flex;
                align-items: center;
                gap: 0.75rem;
                padding: 0.75rem 1.25rem 0.75rem 1rem;
                border-radius: 0.75rem;
                background: var(--sky);
                color: var(--sky-text);
                text-align: left;
            }

            .back-at svg {
                width: 1.5rem;
                height: 1.5rem;
                flex: none;
            }

            .back-at-text {
                display: flex;
                flex-direction: column;
                min-width: 0;
            }

            .back-at-label {
                font-size: 0.75rem;
                line-height: 1rem;
                font-weight: 600;
            }

            .back-at-time {
                font-family: "Bricolage Grotesque", "Figtree", ui-sans-serif, system-ui, sans-serif;
                font-size: 1.75rem;
                line-height: 2rem;
                font-weight: 700;
                letter-spacing: -0.02em;
                color: var(--foreground);
                font-variant-numeric: tabular-nums;
            }

            .back-at-zone {
                font-size: 0.75rem;
                line-height: 1rem;
            }

            .back-at-zone[hidden] {
                display: none;
            }

            .message {
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 0.25rem;
                margin: 0;
            }

            .message blockquote {
                margin: 0;
                font-size: 0.8125rem;
                line-height: 1.25rem;
                font-style: italic;
                overflow-wrap: anywhere;
            }

            .message figcaption {
                display: inline-flex;
                align-items: center;
                gap: 0.5rem;
                font-size: 0.75rem;
                line-height: 1rem;
                color: var(--muted-foreground);
            }

            .avatar {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                width: 1.25rem;
                height: 1.25rem;
                flex: none;
                border-radius: 50%;
                background: var(--muted);
                color: var(--foreground);
                font-size: 0.5625rem;
                font-weight: 600;
                font-style: normal;
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
                .actions {
                    width: 100%;
                }

                .retry {
                    width: 100%;
                    height: 2.75rem;
                }
            }
        </style>
    </head>
