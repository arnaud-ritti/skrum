# Update Procedure in Administration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show an admin how to update the instance, inside the Updates card of Administration › General, with a link to the release notes, and remove the maintenance-message feature.

**Architecture:** The server adds one field, `releaseUrl`, to the version status it already shares, and one page prop, `image`. A new React component, `UpdateProcedure`, renders three tabs of fixed steps with copyable commands inside the existing `UpdatesCard`. The maintenance message is removed front end first, then back end, so the suite stays green between tasks. No migration: rows an earlier build stored are read by nothing.

**Tech Stack:** Laravel 13, Inertia v3, React 19, TypeScript, Radix (`ui/collapsible`, `ui/tabs`), Pest 5, Vitest (`vp test run`), translations in `lang/{en,fr,es,de}.json`.

**Spec:** `docs/superpowers/specs/2026-10-06-update-procedure-design.md`

## Global Constraints

- No dependency is added. No migration is written (rule 5 of `docs/database.md`).
- Every user-facing sentence is a `t('…')` or `__('…')` literal and exists in `lang/en.json`, `fr.json`, `es.json` and `de.json`. In `en.json` the value equals the key. French, Spanish and German use the informal register (tu / tú / du); `tests/Feature/InformalRegisterTest.php` rejects formal forms.
- Shell commands shown in the interface are not translated.
- Every `<button>` rendered inside the general settings form carries `type="button"`: `ui/button` sets no default type, and an untyped button submits the form.
- Links that leave the app: `target="_blank"`, `rel="noreferrer noopener"`.
- Module-level constants are PascalCase (`Methods`, `VersionPlaceholder`), as in the surrounding code.
- PHP: typed everything, early returns, no `else`. After any PHP change: `vendor/bin/pint --dirty --format agent`.
- Tests carry no comments. No plan or spec identifier in code, tests or file names.
- The mockups under `docs/design-system` are not edited.
- The audit-log label `maintenance_message` and the following key `maintenance_message_by` in `resources/js/components/admin/audit-log/audit-action-label.tsx` stay, with their tests.
- Commits follow Conventional Commits, `type(scope): sentence saying what is now true`, and end with the trailer `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Commands: one PHP test file `php artisan test --compact <path>`; one front test file `npx vp test run <path>`; types `npm run types:check`; front lint and format `npm run check`.

## Review Focus

What the spec implies and an admin will meet, most likely first. Each line names the test that pins it.

1. **The instance is served over plain HTTP**, where browsers give pages no clipboard. "Copy" must say it failed, not pretend. Pinned by "says so when the browser gives no clipboard" (Task 2).
2. **The procedure sits inside the settings form.** Opening it, changing tab or copying must not save the form. Pinned by "does not submit the form from the update procedure" (Task 2).
3. **No newer version is known** (check off, never run, or up to date). The commands must still be readable. Pinned by "writes a placeholder where no version is known" (Task 2).
4. **The latest release carries build metadata** (`1.9.0+build.5`). A raw `+` in the link is read as a space. Pinned by the dataset "a release with build metadata" (Task 1).
5. **An earlier build left traces**: a `maintenance_message` row, or a maintenance payload with `message` and `author`. Neither may reach the 503 page or break it. Pinned by "shows the time of return in maintenance, and no message an earlier build stored" and "reads only the time of return from a payload an earlier build wrote" (Task 5).

---

### Task 1: The server names the release notes and the image

**Files:**
- Modify: `app/Support/InstanceVersion.php` (the `status()` method and its docblock)
- Modify: `config/skrum.php` (one line after `repository_url`)
- Modify: `app/Http/Controllers/Admin/GeneralSettingsController.php` (`edit()`)
- Test: `tests/Feature/Support/InstanceVersionTest.php`
- Test: `tests/Feature/Admin/UpdateChecksTest.php`
- Test: `tests/Feature/Admin/GeneralSettingsTest.php`

**Interfaces:**
- Consumes: `config('skrum.repository_url')`.
- Produces: `InstanceVersion::status()` returns `array{state: 'unknown'|'unreleased'|'current'|'outdated', latest: ?string, checkedAt: ?string, releaseUrl: ?string}`; `releaseUrl` is non-null only when `state` is `outdated`. `config('skrum.image')` is `'ghcr.io/arnaud-ritti/skrum'`. The `admin/general` page receives the prop `image: string`. The shared props `versionStatus` and `instanceVersionStatus` carry `releaseUrl`.

- [ ] **Step 1: Write the failing tests**

In `tests/Feature/Support/InstanceVersionTest.php`, replace the three exact-array assertions:

```php
    expect(resolve(InstanceVersion::class)->status())->toBe(['state' => 'unknown', 'latest' => null, 'checkedAt' => null, 'releaseUrl' => null]);
```

```php
    expect(resolve(InstanceVersion::class)->status())->toBe([
        'state' => 'outdated',
        'latest' => '1.9.0',
        'checkedAt' => '2026-10-03T08:00:00+00:00',
        'releaseUrl' => 'https://github.com/arnaud-ritti/skrum/releases/tag/v1.9.0',
    ]);
```

```php
    expect(resolve(InstanceVersion::class)->status())->toBe([
        'state' => $state,
        'latest' => $latest,
        'checkedAt' => '2026-10-03T08:00:00+00:00',
        'releaseUrl' => $state === 'outdated' ? "https://github.com/arnaud-ritti/skrum/releases/tag/v{$latest}" : null,
    ]);
```

Append to the same file:

```php
it('links an outdated instance to the notes of the latest release', function (string $latest, string $url) {
    config(['skrum.version' => '1.8.2', 'skrum.repository_url' => 'https://git.example/acme/skrum/']);
    resolve(InstanceSettings::class)->setMany([
        InstanceSettingKey::LatestVersion->value => $latest,
        InstanceSettingKey::UpdateCheckedAt->value => '2026-10-03T08:00:00+00:00',
    ]);

    expect(resolve(InstanceVersion::class)->status()['releaseUrl'])->toBe($url);
})->with([
    'a plain release' => ['1.9.0', 'https://git.example/acme/skrum/releases/tag/v1.9.0'],
    'a release with build metadata' => ['1.9.0+build.5', 'https://git.example/acme/skrum/releases/tag/v1.9.0%2Bbuild.5'],
]);
```

In `tests/Feature/Admin/UpdateChecksTest.php`, in both tests that assert `versionStatus` ("stores the latest version and the date and says a version is available" and "checks even when the daily check is off"), replace the array with:

```php
['state' => 'outdated', 'latest' => '1.9.0', 'checkedAt' => '2026-10-06T09:30:00+00:00', 'releaseUrl' => 'https://github.com/arnaud-ritti/skrum/releases/tag/v1.9.0']
```

In `tests/Feature/Admin/GeneralSettingsTest.php`, in "opens general from /admin with the environment values as defaults", add one line to the chain, after `->where('updateCheckEnabled', false)`:

```php
        ->where('image', 'ghcr.io/arnaud-ritti/skrum')
```

(move the closing `);` so the chain still ends with `);`).

- [ ] **Step 2: Run them and see them fail**

Run: `php artisan test --compact tests/Feature/Support/InstanceVersionTest.php tests/Feature/Admin/UpdateChecksTest.php tests/Feature/Admin/GeneralSettingsTest.php`
Expected: FAIL. The status assertions fail on a missing `releaseUrl` key, the new test on `Undefined array key "releaseUrl"`, the general page on a missing `image` property.

- [ ] **Step 3: Implement**

In `app/Support/InstanceVersion.php`, replace the docblock and body of `status()` and add `releaseUrl()` below it:

```php
    /**
     * A branch or local build (main, dev, pr-12) has no place in the release order: it is unreleased.
     * What a check stored is compared whether the daily check is on or off: an administrator may ask for one at any time.
     *
     * @return array{
     *     state: 'unknown'|'unreleased'|'current'|'outdated',
     *     latest: ?string,
     *     checkedAt: ?string,
     *     releaseUrl: ?string
     * }
     */
    public function status(): array
    {
        $latest = $this->settings->latestVersion();

        if (! self::isRelease($this->current())) {
            return ['state' => 'unreleased', 'latest' => null, 'checkedAt' => null, 'releaseUrl' => null];
        }

        if ($latest === null) {
            return ['state' => 'unknown', 'latest' => null, 'checkedAt' => null, 'releaseUrl' => null];
        }

        $checkedAt = $this->settings->updateCheckedAt();

        if (! version_compare($this->withoutBuild($latest), $this->withoutBuild($this->current()), '>')) {
            return ['state' => 'current', 'latest' => $latest, 'checkedAt' => $checkedAt, 'releaseUrl' => null];
        }

        return ['state' => 'outdated', 'latest' => $latest, 'checkedAt' => $checkedAt, 'releaseUrl' => $this->releaseUrl($latest)];
    }

    private function releaseUrl(string $version): string
    {
        $repository = rtrim((string) config('skrum.repository_url'), '/');
        $tag = rawurlencode("v{$version}");

        return "{$repository}/releases/tag/{$tag}";
    }
```

In `config/skrum.php`, after the `repository_url` line and its blank line:

```php
    'image' => 'ghcr.io/arnaud-ritti/skrum',

```

In `app/Http/Controllers/Admin/GeneralSettingsController.php`, in the array `edit()` renders, after `'versionStatus' => $version->status(),`:

```php
            'image' => (string) config('skrum.image'),
```

- [ ] **Step 4: Run the tests and see them pass**

Run: `php artisan test --compact tests/Feature/Support/InstanceVersionTest.php tests/Feature/Admin/UpdateChecksTest.php tests/Feature/Admin/GeneralSettingsTest.php tests/Feature/AboutPageTest.php`
Expected: PASS.

- [ ] **Step 5: Format and commit**

```bash
vendor/bin/pint --dirty --format agent
git add app/Support/InstanceVersion.php config/skrum.php app/Http/Controllers/Admin/GeneralSettingsController.php tests/Feature/Support/InstanceVersionTest.php tests/Feature/Admin/UpdateChecksTest.php tests/Feature/Admin/GeneralSettingsTest.php
git commit -m "feat(admin): the version status links to the notes of the latest release

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: The update procedure and the release-notes link in the Updates card

**Files:**
- Create: `resources/js/components/admin/general/update-procedure.tsx`
- Create: `resources/js/components/admin/general/update-procedure.test.tsx`
- Modify: `resources/js/components/admin/general/updates-card.tsx`
- Modify: `resources/js/components/admin/general/updates-card.test.tsx`
- Modify: `resources/js/components/admin/general/general-settings-form.tsx` (pass `image`)
- Modify: `resources/js/components/admin/general/general-settings-form.test.tsx` (fixture, one new test)
- Modify: `resources/js/pages/admin/general.test.tsx` (fixture)
- Modify: `resources/js/lib/admin/types.ts`
- Modify: `resources/js/types/global.d.ts`
- Modify: `lang/en.json`, `lang/fr.json`, `lang/es.json`, `lang/de.json`

**Interfaces:**
- Consumes: from Task 1, `versionStatus.releaseUrl: string | null` and the page prop `image: string`. Existing: `useClipboard(): [string | null, (text: string) => Promise<boolean>]` from `@/hooks/use-clipboard`; `Collapsible`, `CollapsibleTrigger`, `CollapsibleContent` from `@/components/ui/collapsible`; `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent` from `@/components/ui/tabs`; the translation keys `Copy`, `Copied`, `(opens in a new tab)`, `Something went wrong. Please try again.`.
- Produces: `UpdateProcedure({ image: string; version: string | null; defaultOpen: boolean })`, whose root carries `data-slot="update-procedure"` and each command `data-slot="update-command"`. `UpdatesCard` gains the required prop `image: string`. `InstanceVersionStatus` gains `releaseUrl: string | null`; `GeneralSettingsPageProps` gains `image: string`. Task 4 uses `[data-slot="update-procedure"]` as the ready marker of a visual test.

- [ ] **Step 1: Extend the types**

In `resources/js/lib/admin/types.ts`, `InstanceVersionStatus` becomes:

```ts
export type InstanceVersionStatus = {
    state: InstanceVersionState;
    latest: string | null;
    checkedAt: string | null;
    /** The notes of the latest release, while the instance is behind it. */
    releaseUrl: string | null;
};
```

and `GeneralSettingsPageProps` gains, after `versionStatus: InstanceVersionStatus;`:

```ts
    /** The published image, named in the update procedure. */
    image: string;
```

In `resources/js/types/global.d.ts`, the inline shape of `instanceVersionStatus` gains, after `checkedAt: string | null;`:

```ts
                releaseUrl: string | null;
```

- [ ] **Step 2: Write the failing component test**

Create `resources/js/components/admin/general/update-procedure.test.tsx`:

```tsx
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { UpdateProcedure } from './update-procedure';

const writeText = vi.fn();
const toastError = vi.hoisted(() => vi.fn());

vi.mock('@inertiajs/react', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@inertiajs/react')>()),
    usePage: () => ({ props: { translations: {}, locale: 'en' } }),
}));

vi.mock('sonner', () => ({ toast: { error: toastError } }));

function setup(version: string | null, defaultOpen = true) {
    return renderWithProviders(
        <UpdateProcedure
            image="ghcr.io/arnaud-ritti/skrum"
            version={version}
            defaultOpen={defaultOpen}
        />,
    );
}

function commands(): string[] {
    return Array.from(
        document.querySelectorAll('[data-slot=update-command]'),
    ).map((command) => command.textContent ?? '');
}

function steps(): string[] {
    return screen
        .getAllByRole('listitem')
        .map((step) => step.querySelector('p')?.textContent ?? '');
}

beforeEach(() => {
    toastError.mockReset();
    writeText.mockReset();
    writeText.mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: { writeText },
    });
});

describe('UpdateProcedure', () => {
    it('stays closed until asked', async () => {
        setup(null, false);

        expect(screen.queryByRole('tablist')).toBeNull();

        await userEvent.click(
            screen.getByRole('button', { name: 'How to update' }),
        );

        expect(
            screen.getByRole('tablist', { name: 'Kind of install' }),
        ).toBeTruthy();
    });

    it('opens on the Docker Compose steps, the backup first', () => {
        setup('0.0.2');

        expect(
            screen
                .getByRole('tab', { name: 'Docker Compose' })
                .getAttribute('aria-selected'),
        ).toBe('true');
        expect(steps()).toEqual([
            'Back up the database and the app-storage volume.',
            'If SKRUM_IMAGE pins a version in your .env file, set it to the new one.',
            'Pull the image and recreate the containers. Use the name of your own Compose file if it differs.',
            'Migrations run by themselves when the container starts. Reload this page: the version above is the new one.',
        ]);
        expect(commands()).toEqual([
            'SKRUM_IMAGE=ghcr.io/arnaud-ritti/skrum:0.0.2',
            'docker compose -f compose.production.yaml pull && docker compose -f compose.production.yaml up -d',
        ]);
    });

    it('names the image and its new version for Coolify', async () => {
        setup('0.0.2');

        await userEvent.click(screen.getByRole('tab', { name: 'Coolify' }));

        expect(steps()).toEqual([
            'Back up the database and the storage volume.',
            'In the service, edit the Compose file and set the image to the new version.',
            'Press Deploy. Migrations run by themselves when the container starts.',
            'Reload this page: the version above is the new one.',
        ]);
        expect(commands()).toEqual(['ghcr.io/arnaud-ritti/skrum:0.0.2']);
    });

    it('checks out the new tag from source', async () => {
        setup('0.0.2');

        await userEvent.click(screen.getByRole('tab', { name: 'From source' }));

        expect(steps()).toEqual([
            'Back up the database and the storage/app directory.',
            'Fetch the new version.',
            'Install the dependencies and build the interface.',
            'Run the migrations and rebuild the caches.',
            'Restart the web server, the queue worker, Reverb and the scheduler.',
        ]);
        expect(commands()).toEqual([
            'git fetch --tags && git checkout v0.0.2',
            'composer install --no-dev --optimize-autoloader && npm ci && npm run build',
            'php artisan migrate --force && php artisan optimize',
        ]);
    });

    it('writes a placeholder where no version is known', async () => {
        setup(null);

        expect(commands()[0]).toBe(
            'SKRUM_IMAGE=ghcr.io/arnaud-ritti/skrum:<version>',
        );

        await userEvent.click(screen.getByRole('tab', { name: 'From source' }));

        expect(commands()[0]).toBe(
            'git fetch --tags && git checkout v<version>',
        );
    });

    it('copies the exact command and says so on its button', async () => {
        setup('0.0.2');

        await userEvent.click(
            screen.getAllByRole('button', { name: 'Copy' })[0],
        );

        expect(writeText).toHaveBeenCalledWith(
            'SKRUM_IMAGE=ghcr.io/arnaud-ritti/skrum:0.0.2',
        );
        await waitFor(() =>
            expect(screen.getByRole('button', { name: 'Copied' })).toBeTruthy(),
        );
        expect(screen.getAllByRole('button', { name: 'Copy' })).toHaveLength(1);
    });

    it('says so when the browser gives no clipboard', async () => {
        Reflect.deleteProperty(navigator, 'clipboard');
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        setup('0.0.2');

        await userEvent.click(
            screen.getAllByRole('button', { name: 'Copy' })[0],
        );

        await waitFor(() =>
            expect(toastError).toHaveBeenCalledWith(
                'Something went wrong. Please try again.',
            ),
        );
        expect(screen.queryByRole('button', { name: 'Copied' })).toBeNull();
    });

    it('is driven by the keyboard alone', async () => {
        const user = userEvent.setup();

        setup('0.0.2', false);

        await user.tab();
        await user.keyboard('{Enter}');
        await user.tab();

        expect(document.activeElement).toBe(
            screen.getByRole('tab', { name: 'Docker Compose' }),
        );

        await user.keyboard('{ArrowRight}');

        expect(
            screen
                .getByRole('tab', { name: 'Coolify' })
                .getAttribute('aria-selected'),
        ).toBe('true');
    });
});
```

- [ ] **Step 3: Run it and see it fail**

Run: `npx vp test run resources/js/components/admin/general/update-procedure.test.tsx`
Expected: FAIL with `Failed to resolve import "./update-procedure"`.

- [ ] **Step 4: Write the component**

Create `resources/js/components/admin/general/update-procedure.tsx`:

```tsx
import { Check, ChevronDown, Copy } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useClipboard } from '@/hooks/use-clipboard';
import { useTrans } from '@/hooks/use-trans';

const Methods = ['compose', 'coolify', 'source'] as const;
const VersionPlaceholder = '<version>';

type Method = (typeof Methods)[number];

type Step = { text: string; command?: string };

type UpdateProcedureProps = {
    /** The published image, without its tag. */
    image: string;
    /** The version to move to; null while no newer one is known. */
    version: string | null;
    defaultOpen: boolean;
};

function Command({
    command,
    copied,
    onCopy,
}: {
    command: string;
    copied: boolean;
    onCopy: (command: string) => void;
}) {
    const { t } = useTrans();

    return (
        <div className="mt-1.5 flex min-w-0 items-start gap-2">
            <pre
                data-slot="update-command"
                className="min-w-0 flex-1 rounded-md border bg-muted p-2 font-mono text-xs break-all whitespace-pre-wrap"
            >
                {command}
            </pre>
            <Button
                type="button"
                variant="outline"
                size="sm"
                className="shrink-0"
                onClick={() => onCopy(command)}
            >
                {copied ? (
                    <Check aria-hidden="true" />
                ) : (
                    <Copy aria-hidden="true" />
                )}
                <span>{copied ? t('Copied') : t('Copy')}</span>
            </Button>
        </div>
    );
}

/** How to move the instance to a newer version, for each kind of install. */
export function UpdateProcedure({
    image,
    version,
    defaultOpen,
}: UpdateProcedureProps) {
    const { t } = useTrans();
    const [copied, copy] = useClipboard();
    const target = version ?? VersionPlaceholder;
    const labels: Record<Method, string> = {
        compose: 'Docker Compose',
        coolify: 'Coolify',
        source: t('From source'),
    };
    const steps: Record<Method, Step[]> = {
        compose: [
            { text: t('Back up the database and the app-storage volume.') },
            {
                text: t(
                    'If SKRUM_IMAGE pins a version in your .env file, set it to the new one.',
                ),
                command: `SKRUM_IMAGE=${image}:${target}`,
            },
            {
                text: t(
                    'Pull the image and recreate the containers. Use the name of your own Compose file if it differs.',
                ),
                command:
                    'docker compose -f compose.production.yaml pull && docker compose -f compose.production.yaml up -d',
            },
            {
                text: t(
                    'Migrations run by themselves when the container starts. Reload this page: the version above is the new one.',
                ),
            },
        ],
        coolify: [
            { text: t('Back up the database and the storage volume.') },
            {
                text: t(
                    'In the service, edit the Compose file and set the image to the new version.',
                ),
                command: `${image}:${target}`,
            },
            {
                text: t(
                    'Press Deploy. Migrations run by themselves when the container starts.',
                ),
            },
            {
                text: t('Reload this page: the version above is the new one.'),
            },
        ],
        source: [
            { text: t('Back up the database and the storage/app directory.') },
            {
                text: t('Fetch the new version.'),
                command: `git fetch --tags && git checkout v${target}`,
            },
            {
                text: t('Install the dependencies and build the interface.'),
                command:
                    'composer install --no-dev --optimize-autoloader && npm ci && npm run build',
            },
            {
                text: t('Run the migrations and rebuild the caches.'),
                command: 'php artisan migrate --force && php artisan optimize',
            },
            {
                text: t(
                    'Restart the web server, the queue worker, Reverb and the scheduler.',
                ),
            },
        ],
    };

    async function copyCommand(command: string): Promise<void> {
        if (!(await copy(command))) {
            toast.error(t('Something went wrong. Please try again.'));
        }
    }

    return (
        <Collapsible defaultOpen={defaultOpen} data-slot="update-procedure">
            <CollapsibleTrigger asChild>
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="group -ml-2 max-w-full gap-1.5 text-muted-foreground"
                >
                    <span className="truncate">{t('How to update')}</span>
                    <ChevronDown
                        aria-hidden="true"
                        className="transition-transform group-data-[state=open]:rotate-180"
                    />
                </Button>
            </CollapsibleTrigger>
            <CollapsibleContent>
                <Tabs<Method> defaultValue="compose" className="mt-2 gap-3">
                    <TabsList aria-label={t('Kind of install')}>
                        {Methods.map((method) => (
                            <TabsTrigger key={method} value={method}>
                                {labels[method]}
                            </TabsTrigger>
                        ))}
                    </TabsList>
                    {Methods.map((method) => (
                        <TabsContent key={method} value={method}>
                            <ol className="flex min-w-0 list-decimal flex-col gap-3 pl-5 text-body-sm">
                                {steps[method].map((step) => (
                                    <li key={step.text} className="min-w-0">
                                        <p>{step.text}</p>
                                        {step.command !== undefined && (
                                            <Command
                                                command={step.command}
                                                copied={copied === step.command}
                                                onCopy={(command) =>
                                                    void copyCommand(command)
                                                }
                                            />
                                        )}
                                    </li>
                                ))}
                            </ol>
                        </TabsContent>
                    ))}
                </Tabs>
            </CollapsibleContent>
        </Collapsible>
    );
}
```

- [ ] **Step 5: Run the component test and see it pass**

Run: `npx vp test run resources/js/components/admin/general/update-procedure.test.tsx`
Expected: PASS, 8 tests.

- [ ] **Step 6: Write the failing card tests**

In `resources/js/components/admin/general/updates-card.test.tsx`:

1. In `setup()`, add the prop `image="ghcr.io/arnaud-ritti/skrum"` to `<UpdatesCard … />`.
2. Add `releaseUrl: null` to every status literal of the file (every object that has `state`, `latest` and `checkedAt`).
3. Append inside `describe('UpdatesCard', …)`:

```tsx
    it('links to the notes of the newer release and opens the procedure', () => {
        setup({
            state: 'outdated',
            latest: '1.9.0',
            checkedAt: '2026-10-02T10:00:00',
            releaseUrl:
                'https://github.com/arnaud-ritti/skrum/releases/tag/v1.9.0',
        });

        const link = screen.getByRole('link', { name: /Release notes/ });

        expect(link.getAttribute('href')).toBe(
            'https://github.com/arnaud-ritti/skrum/releases/tag/v1.9.0',
        );
        expect(link.getAttribute('target')).toBe('_blank');
        expect(link.getAttribute('rel')).toBe('noreferrer noopener');
        expect(
            document
                .querySelector('[data-slot=update-procedure]')
                ?.getAttribute('data-state'),
        ).toBe('open');
        expect(
            document.querySelector('[data-slot=update-command]')?.textContent,
        ).toBe('SKRUM_IMAGE=ghcr.io/arnaud-ritti/skrum:1.9.0');
    });

    it.each([
        {
            state: 'current',
            latest: '1.8.2',
            checkedAt: '2026-10-02T10:00:00',
            releaseUrl: null,
        },
        { state: 'unknown', latest: null, checkedAt: null, releaseUrl: null },
        {
            state: 'unreleased',
            latest: null,
            checkedAt: null,
            releaseUrl: null,
        },
    ] satisfies InstanceVersionStatus[])(
        'keeps the procedure closed and shows no release link while $state',
        (status) => {
            setup(status);

            expect(screen.queryByRole('link', { name: /Release notes/ })).toBeNull();
            expect(
                document
                    .querySelector('[data-slot=update-procedure]')
                    ?.getAttribute('data-state'),
            ).toBe('closed');
            expect(
                screen.getByRole('button', { name: 'How to update' }),
            ).toBeTruthy();
        },
    );
```

In `resources/js/components/admin/general/general-settings-form.test.tsx`:

1. In `props()`, replace the `versionStatus` line and add `image`:

```ts
        versionStatus: {
            state: 'unknown',
            latest: null,
            checkedAt: null,
            releaseUrl: null,
        },
        image: 'ghcr.io/arnaud-ritti/skrum',
```

2. Append inside `describe('GeneralSettingsForm saving', …)`:

```tsx
    it('does not submit the form from the update procedure', async () => {
        const visit = spyOnVisit();

        Object.defineProperty(navigator, 'clipboard', {
            configurable: true,
            value: { writeText: vi.fn().mockResolvedValue(undefined) },
        });
        setup({ signupMode: 'open' });

        fireEvent.click(
            screen.getByRole('switch', {
                name: 'Check for new versions once a day',
            }),
        );
        fireEvent.click(screen.getByRole('button', { name: 'How to update' }));
        fireEvent.click(screen.getAllByRole('button', { name: 'Copy' })[0]);

        await waitFor(() =>
            expect(screen.getByRole('button', { name: 'Copied' })).toBeTruthy(),
        );
        expect(visit).not.toHaveBeenCalled();
        expect(status()).toBe('1 unsaved change');
    });
```

Add `waitFor` to the import from `@testing-library/react` at the top of the file. `resources/js/test/setup.ts` removes `navigator.clipboard` after each test.

In `resources/js/pages/admin/general.test.tsx`, add `releaseUrl: null,` inside the `versionStatus` literal and the prop `image="ghcr.io/arnaud-ritti/skrum"` after it.

- [ ] **Step 7: Run them and see them fail**

Run: `npx vp test run resources/js/components/admin/general/updates-card.test.tsx resources/js/components/admin/general/general-settings-form.test.tsx`
Expected: FAIL. No link named "Release notes", no `[data-slot=update-procedure]`, no button "How to update".

- [ ] **Step 8: Put the link and the procedure in the card**

In `resources/js/components/admin/general/updates-card.tsx`:

1. Add the imports:

```tsx
import { ExternalLink } from 'lucide-react';
import { UpdateProcedure } from './update-procedure';
```

2. Add `image: string;` to `UpdatesCardProps`, after `version: string;`, and `image,` to the destructured props, after `version,`.

3. Immediately before the closing `</SettingsCard>`, after the `</div>` that closes the block holding the switch and the last-check row, add:

```tsx
            {status.releaseUrl !== null && (
                <a
                    href={status.releaseUrl}
                    target="_blank"
                    rel="noreferrer noopener"
                    data-slot="update-release-notes"
                    className="inline-flex items-center gap-1 self-start rounded-sm text-sm font-medium text-skrum-primary-text underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                >
                    {t('Release notes')}
                    <ExternalLink aria-hidden="true" className="size-3.5" />
                    <span className="sr-only">{t('(opens in a new tab)')}</span>
                </a>
            )}
            <UpdateProcedure
                image={image}
                version={status.state === 'outdated' ? status.latest : null}
                defaultOpen={status.state === 'outdated'}
            />
```

In `resources/js/components/admin/general/general-settings-form.tsx`, add to `<UpdatesCard … />`, after `version={props.version}`:

```tsx
                image={props.image}
```

- [ ] **Step 9: Add the translations**

Run:

```bash
python3 - <<'EOF'
import json
import pathlib

anchor = 'Checked :relative: up to date.'
lines = {
    'How to update': {
        'fr': 'Comment mettre à jour',
        'es': 'Cómo actualizar',
        'de': 'So aktualisierst du',
    },
    'Kind of install': {
        'fr': "Type d'installation",
        'es': 'Tipo de instalación',
        'de': 'Art der Installation',
    },
    'From source': {
        'fr': 'Depuis les sources',
        'es': 'Desde el código fuente',
        'de': 'Aus dem Quellcode',
    },
    'Release notes': {
        'fr': 'Notes de version',
        'es': 'Notas de la versión',
        'de': 'Versionshinweise',
    },
    'Back up the database and the app-storage volume.': {
        'fr': 'Sauvegarde la base de données et le volume app-storage.',
        'es': 'Haz una copia de seguridad de la base de datos y del volumen app-storage.',
        'de': 'Sichere die Datenbank und das Volume app-storage.',
    },
    'If SKRUM_IMAGE pins a version in your .env file, set it to the new one.': {
        'fr': 'Si SKRUM_IMAGE fixe une version dans ton fichier .env, remplace-la par la nouvelle.',
        'es': 'Si SKRUM_IMAGE fija una versión en tu archivo .env, cámbiala por la nueva.',
        'de': 'Wenn SKRUM_IMAGE in deiner .env-Datei eine Version festlegt, trage dort die neue ein.',
    },
    'Pull the image and recreate the containers. Use the name of your own Compose file if it differs.': {
        'fr': "Récupère l'image et recrée les conteneurs. Utilise le nom de ton fichier Compose s'il est différent.",
        'es': 'Descarga la imagen y vuelve a crear los contenedores. Usa el nombre de tu archivo Compose si es distinto.',
        'de': 'Lade das Image und erstelle die Container neu. Nimm den Namen deiner eigenen Compose-Datei, falls er abweicht.',
    },
    'Migrations run by themselves when the container starts. Reload this page: the version above is the new one.': {
        'fr': 'Les migrations se lancent toutes seules au démarrage du conteneur. Recharge cette page : la version affichée ci-dessus est la nouvelle.',
        'es': 'Las migraciones se ejecutan solas al arrancar el contenedor. Recarga esta página: la versión de arriba es la nueva.',
        'de': 'Die Migrationen laufen beim Start des Containers von selbst. Lade diese Seite neu: Die Version oben ist dann die neue.',
    },
    'Back up the database and the storage volume.': {
        'fr': 'Sauvegarde la base de données et le volume de stockage.',
        'es': 'Haz una copia de seguridad de la base de datos y del volumen de almacenamiento.',
        'de': 'Sichere die Datenbank und das Speicher-Volume.',
    },
    'In the service, edit the Compose file and set the image to the new version.': {
        'fr': "Dans le service, modifie le fichier Compose et indique la nouvelle version de l'image.",
        'es': 'En el servicio, edita el archivo Compose y pon la nueva versión de la imagen.',
        'de': 'Bearbeite im Dienst die Compose-Datei und trage die neue Version des Images ein.',
    },
    'Press Deploy. Migrations run by themselves when the container starts.': {
        'fr': 'Appuie sur Deploy. Les migrations se lancent toutes seules au démarrage du conteneur.',
        'es': 'Pulsa Deploy. Las migraciones se ejecutan solas al arrancar el contenedor.',
        'de': 'Drücke auf Deploy. Die Migrationen laufen beim Start des Containers von selbst.',
    },
    'Reload this page: the version above is the new one.': {
        'fr': 'Recharge cette page : la version affichée ci-dessus est la nouvelle.',
        'es': 'Recarga esta página: la versión de arriba es la nueva.',
        'de': 'Lade diese Seite neu: Die Version oben ist dann die neue.',
    },
    'Back up the database and the storage/app directory.': {
        'fr': 'Sauvegarde la base de données et le dossier storage/app.',
        'es': 'Haz una copia de seguridad de la base de datos y del directorio storage/app.',
        'de': 'Sichere die Datenbank und das Verzeichnis storage/app.',
    },
    'Fetch the new version.': {
        'fr': 'Récupère la nouvelle version.',
        'es': 'Descarga la nueva versión.',
        'de': 'Hole die neue Version.',
    },
    'Install the dependencies and build the interface.': {
        'fr': "Installe les dépendances et compile l'interface.",
        'es': 'Instala las dependencias y compila la interfaz.',
        'de': 'Installiere die Abhängigkeiten und baue die Oberfläche.',
    },
    'Run the migrations and rebuild the caches.': {
        'fr': 'Lance les migrations et reconstruis les caches.',
        'es': 'Ejecuta las migraciones y reconstruye las cachés.',
        'de': 'Führe die Migrationen aus und baue die Caches neu auf.',
    },
    'Restart the web server, the queue worker, Reverb and the scheduler.': {
        'fr': 'Redémarre le serveur web, le worker de la file, Reverb et le planificateur.',
        'es': 'Reinicia el servidor web, el worker de la cola, Reverb y el planificador.',
        'de': 'Starte den Webserver, den Queue-Worker, Reverb und den Scheduler neu.',
    },
}

for locale in ['en', 'fr', 'es', 'de']:
    path = pathlib.Path(f'lang/{locale}.json')
    current = json.loads(path.read_text(encoding='utf-8'))
    assert anchor in current, f'{locale}: anchor missing'
    updated = {}
    for key, value in current.items():
        updated[key] = value
        if key != anchor:
            continue
        for new_key, translations in lines.items():
            assert new_key not in current, f'{locale}: {new_key} already exists'
            updated[new_key] = new_key if locale == 'en' else translations[locale]
    path.write_text(json.dumps(updated, ensure_ascii=False, indent=4) + '\n', encoding='utf-8')
EOF
git diff --stat lang/
```

Expected: four files changed, 17 insertions each, no deletion. The four files round-trip byte for byte through this serialisation, so the diff holds the new lines only.

- [ ] **Step 10: Run everything this task touches**

Run:

```bash
npx vp test run resources/js/components/admin/general resources/js/pages/admin/general.test.tsx
npm run types:check
php artisan test --compact tests/Feature/TranslationKeysTest.php tests/Feature/InformalRegisterTest.php tests/Feature/FrenchElisionTest.php
```

Expected: all PASS, no type error.

- [ ] **Step 11: Lint, format and commit**

```bash
npm run check:fix
git add resources/js/components/admin/general resources/js/pages/admin/general.test.tsx resources/js/lib/admin/types.ts resources/js/types/global.d.ts lang/en.json lang/fr.json lang/es.json lang/de.json
git commit -m "feat(admin): the Updates card says how to update and links to the release notes

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: The sidebar links to the release, the MCP page says to restart

**Files:**
- Modify: `resources/js/components/admin/admin-shell.tsx` (`InstanceVersionLine`)
- Modify: `resources/js/components/admin/admin-shell.test.tsx`
- Modify: `resources/js/pages/admin/mcp-keys.tsx`
- Modify: `resources/js/pages/admin/mcp-keys.test.tsx`
- Modify: `lang/en.json`, `lang/fr.json`, `lang/es.json`, `lang/de.json`

**Interfaces:**
- Consumes: `instanceVersionStatus.releaseUrl: string | null` from Tasks 1 and 2.
- Produces: nothing a later task uses.

- [ ] **Step 1: Write the failing tests**

In `resources/js/components/admin/admin-shell.test.tsx`, in "says an update is available, in words and with an icon", add `releaseUrl` to the status and three assertions at the end of the test:

```tsx
            instanceVersionStatus: {
                state: 'outdated',
                latest: '1.9.0',
                checkedAt: '2026-10-03T08:00:00Z',
                releaseUrl:
                    'https://github.com/arnaud-ritti/skrum/releases/tag/v1.9.0',
            },
```

```tsx
        const link = state?.querySelector('a');

        expect(link?.getAttribute('href')).toBe(
            'https://github.com/arnaud-ritti/skrum/releases/tag/v1.9.0',
        );
        expect(link?.getAttribute('target')).toBe('_blank');
        expect(link?.getAttribute('rel')).toBe('noreferrer noopener');
        expect(link?.getAttribute('aria-label')).toBe(
            'update available: v1.9.0 (opens in a new tab)',
        );
```

The existing assertion `expect(version?.textContent).toBe('v1.8.2 · update available: v1.9.0');` stays and must keep passing. Add `releaseUrl: null` to the two other status literals of the file.

In `resources/js/pages/admin/mcp-keys.test.tsx`, replace both occurrences of `'The MCP server is off (SKRUM_MCP_ENABLED).'` with:

```tsx
'The MCP server is off (SKRUM_MCP_ENABLED). Restart the instance after changing it.'
```

- [ ] **Step 2: Run them and see them fail**

Run: `npx vp test run resources/js/components/admin/admin-shell.test.tsx resources/js/pages/admin/mcp-keys.test.tsx`
Expected: FAIL. `link` is undefined in the first; the sentence is not found in "warns that the MCP server is off and still lists the keys".

- [ ] **Step 3: Implement**

In `resources/js/components/admin/admin-shell.tsx`, replace the outdated branch of `InstanceVersionLine` (the block starting `{status?.state === 'outdated' && status.latest !== null && (`) with:

```tsx
            {status?.state === 'outdated' && status.latest !== null && (
                <span
                    data-slot="admin-version-state"
                    className="text-skrum-warning-text"
                >
                    {' · '}
                    <OutdatedLabel
                        latest={status.latest}
                        releaseUrl={status.releaseUrl}
                    />
                    <TriangleAlert
                        aria-hidden="true"
                        className="ml-1 inline-block size-3 align-middle"
                    />
                </span>
            )}
```

and add this component above `InstanceVersionLine`:

```tsx
/** "update available", a link to the release notes when the server names them. */
function OutdatedLabel({
    latest,
    releaseUrl,
}: {
    latest: string;
    releaseUrl: string | null;
}) {
    const { t } = useTrans();
    const label = t('update available: v:version', { version: latest });

    if (releaseUrl === null) {
        return label;
    }

    return (
        <a
            href={releaseUrl}
            target="_blank"
            rel="noreferrer noopener"
            aria-label={`${label} ${t('(opens in a new tab)')}`}
            className="rounded-sm underline underline-offset-2 outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
            {label}
        </a>
    );
}
```

In `resources/js/pages/admin/mcp-keys.tsx`, replace the key `'The MCP server is off (:env).'` with:

```tsx
'The MCP server is off (:env). Restart the instance after changing it.'
```

(the `{ env: 'SKRUM_MCP_ENABLED' }` argument does not change).

- [ ] **Step 4: Reword the translation in the four files**

Run:

```bash
python3 - <<'EOF'
import json
import pathlib

old = 'The MCP server is off (:env).'
new = 'The MCP server is off (:env). Restart the instance after changing it.'
added = {
    'fr': " Redémarre l'instance après l'avoir modifié.",
    'es': ' Reinicia la instancia después de cambiarlo.',
    'de': ' Starte die Instanz nach einer Änderung neu.',
}

for locale in ['en', 'fr', 'es', 'de']:
    path = pathlib.Path(f'lang/{locale}.json')
    current = json.loads(path.read_text(encoding='utf-8'))
    assert old in current and new not in current, locale
    updated = {}
    for key, value in current.items():
        if key != old:
            updated[key] = value
            continue
        updated[new] = new if locale == 'en' else value + added[locale]
    path.write_text(json.dumps(updated, ensure_ascii=False, indent=4) + '\n', encoding='utf-8')
EOF
git diff --stat lang/
```

Expected: four files, one line changed in each.

- [ ] **Step 5: Run the tests and see them pass**

Run:

```bash
npx vp test run resources/js/components/admin/admin-shell.test.tsx resources/js/pages/admin/mcp-keys.test.tsx
npm run types:check
php artisan test --compact tests/Feature/TranslationKeysTest.php tests/Feature/InformalRegisterTest.php tests/Feature/FrenchElisionTest.php
```

Expected: all PASS.

- [ ] **Step 6: Lint, format and commit**

```bash
npm run check:fix
git add resources/js/components/admin/admin-shell.tsx resources/js/components/admin/admin-shell.test.tsx resources/js/pages/admin/mcp-keys.tsx resources/js/pages/admin/mcp-keys.test.tsx lang/en.json lang/fr.json lang/es.json lang/de.json
git commit -m "feat(admin): the sidebar links to the new release, the MCP page says to restart

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: The maintenance message leaves the interface

The owner approved deleting the tests that cover the message (spec §2, answer 3).

**Files:**
- Delete: `resources/js/components/admin/general/maintenance-message-card.tsx`
- Delete: `resources/js/components/admin/general/maintenance-message-card.test.tsx`
- Modify: `resources/js/components/admin/general/general-settings-form.tsx`
- Modify: `resources/js/components/admin/general/general-settings-form.test.tsx`
- Modify: `resources/js/pages/admin/general.tsx` (`formSignature`)
- Modify: `resources/js/pages/admin/general.test.tsx`
- Modify: `resources/js/lib/admin/types.ts`
- Modify: `tests/Browser/Visual/AdminAndErrorPagesVisualTest.php` (one ready marker)

**Interfaces:**
- Consumes: `[data-slot="update-procedure"]` from Task 2.
- Produces: `GeneralSettingsPageProps` without `maintenanceMessage`, `maintenanceMessageBy`, `maintenanceMessageAt`. The form no longer sends `maintenance_message`. The server still sends the three props and still accepts the field until Task 5; the front end ignores them.

- [ ] **Step 1: Rewrite the form tests for a form without the message**

In `resources/js/components/admin/general/general-settings-form.test.tsx`:

1. In `props()`, delete the three lines `maintenanceMessage: null,`, `maintenanceMessageBy: null,`, `maintenanceMessageAt: null,`.
2. Delete the helper `message()`.
3. Replace the whole `describe('GeneralSettingsForm unsaved changes', …)` block with:

```tsx
describe('GeneralSettingsForm unsaved changes', () => {
    it('counts each changed field and returns to zero on Cancel', () => {
        setup();

        expect(status()).toBe('No unsaved changes');
        expect(saveButton().disabled).toBe(true);

        fireEvent.click(
            screen.getByRole('radio', { name: 'Open to everyone' }),
        );

        expect(status()).toBe('1 unsaved change');

        fireEvent.click(
            screen.getByRole('switch', {
                name: 'Check for new versions once a day',
            }),
        );

        expect(status()).toBe('2 unsaved changes');

        fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

        expect(status()).toBe('No unsaved changes');
        expect(
            screen
                .getByRole('radio', { name: 'Invitation only' })
                .getAttribute('aria-checked'),
        ).toBe('true');
    });

    it('does not count an edit that comes back to the saved value', () => {
        setup();

        const dailyCheck = screen.getByRole('switch', {
            name: 'Check for new versions once a day',
        });

        fireEvent.click(dailyCheck);
        fireEvent.click(dailyCheck);

        expect(status()).toBe('No unsaved changes');
    });

    it('offers no maintenance message', () => {
        setup();

        expect(screen.queryByLabelText('Message')).toBeNull();
        expect(screen.queryByText('Maintenance message')).toBeNull();
    });
});
```

4. Delete the whole `describe('GeneralSettingsForm maintenance message', …)` block.
5. In `describe('GeneralSettingsForm saving', …)`, replace the three tests "sends only the changed fields", "sends a cleared message as null and the domains with the mode" and "shows the server errors under their fields" with:

```tsx
    it('sends only the changed fields', () => {
        const visit = spyOnVisit();

        setup({ signupMode: 'open' });

        fireEvent.click(
            screen.getByRole('switch', {
                name: 'Check for new versions once a day',
            }),
        );
        submit();

        expect(visit).toHaveBeenCalledOnce();
        expect(visit.mock.calls[0][1]?.method).toBe('put');
        expect(visit.mock.calls[0][1]?.data).toEqual({
            update_check_enabled: true,
        });
    });

    it('sends the domains with the mode', () => {
        const visit = spyOnVisit();

        setup();

        fireEvent.click(screen.getByRole('radio', { name: 'Allowed domains' }));

        const input = screen.getByLabelText('Email domains');

        fireEvent.change(input, { target: { value: 'acme.fr' } });
        fireEvent.keyDown(input, { key: 'Enter' });
        submit();

        expect(visit.mock.calls[0][1]?.data).toEqual({
            signup_mode: 'domain',
            allowed_email_domains: ['acme.fr'],
        });
    });

    it('shows the server errors under their fields', () => {
        const visit = spyOnVisit();

        setup({ signupMode: 'domain', allowedEmailDomains: ['acme.fr'] });

        fireEvent.click(
            screen.getByRole('switch', {
                name: 'Check for new versions once a day',
            }),
        );
        submit();

        act(() => {
            visit.mock.calls[0][1]?.onError?.({
                'allowed_email_domains.0': 'The domain is not valid.',
            });
        });

        expect(screen.getByText('The domain is not valid.')).not.toBeNull();

        const input = screen.getByLabelText('Email domains');

        fireEvent.change(input, { target: { value: 'atlas.fr' } });
        fireEvent.keyDown(input, { key: 'Enter' });

        expect(screen.queryByText('The domain is not valid.')).toBeNull();
    });
```

The test "does not submit the form from the update procedure" added in Task 2 stays.

In `resources/js/pages/admin/general.test.tsx`, delete the three props `maintenanceMessage={null}`, `maintenanceMessageBy={null}`, `maintenanceMessageAt={null}`.

- [ ] **Step 2: Run them and see them fail**

Run: `npx vp test run resources/js/components/admin/general/general-settings-form.test.tsx`
Expected: FAIL on "offers no maintenance message" only: the card is still rendered, so the label "Message" is found. The other rewritten tests already pass.

- [ ] **Step 3: Remove the card from the form**

Delete the two files:

```bash
git rm resources/js/components/admin/general/maintenance-message-card.tsx resources/js/components/admin/general/maintenance-message-card.test.tsx
```

In `resources/js/components/admin/general/general-settings-form.tsx`:

1. Delete the import of `MaintenanceMessageCard` and `MaintenanceMessageMaxLength` (the four lines importing from `./maintenance-message-card`).
2. Delete `maintenance_message: string;` from `GeneralFormData` and `maintenance_message?: string | null;` from `GeneralPayload`.
3. In `initialData()`, delete the line `maintenance_message: props.maintenanceMessage ?? '',`.
4. In `changedFields()`, delete the block:

```tsx
    if (current.maintenance_message.trim() !== initial.maintenance_message) {
        const message = current.maintenance_message.trim();

        payload.maintenance_message = message === '' ? null : message;
    }
```

5. Replace

```tsx
    const messageTooLong =
        data.maintenance_message.trim().length > MaintenanceMessageMaxLength;
    const canSave = !missingDomain && !messageTooLong;
```

with

```tsx
    const canSave = !missingDomain;
```

6. Delete the whole `<MaintenanceMessageCard … />` element (from `<MaintenanceMessageCard` to its closing `/>`).

In `resources/js/lib/admin/types.ts`, delete from `GeneralSettingsPageProps`:

```ts
    maintenanceMessage: string | null;
    maintenanceMessageBy: { name: string } | null;
    maintenanceMessageAt: string | null;
```

In `resources/js/pages/admin/general.tsx`, `formSignature()` becomes:

```tsx
function formSignature(props: GeneralSettingsPageProps): string {
    return JSON.stringify([
        props.signupMode,
        props.allowedEmailDomains,
        props.updateCheckEnabled,
    ]);
}
```

- [ ] **Step 4: Give the visual test a marker that still exists**

In `tests/Browser/Visual/AdminAndErrorPagesVisualTest.php`, in the dataset of "renders the admin sections without overflow", the `general` row becomes:

```php
    'general' => ['admin-general-page', '/admin/general', '[data-slot="general-settings-form"] [data-slot="update-procedure"]'],
```

- [ ] **Step 5: Run the tests and see them pass**

Run:

```bash
npx vp test run resources/js/components/admin resources/js/pages/admin
npm run types:check
php artisan test --compact tests/Feature/Admin/GeneralSettingsTest.php tests/Feature/TranslationKeysTest.php
```

Expected: all PASS, no type error. `audit-action-label.test.tsx` still passes: its label was not touched.

- [ ] **Step 6: Lint, format and commit**

```bash
npm run check:fix
vendor/bin/pint --dirty --format agent
git add -A resources/js/components/admin/general resources/js/pages/admin/general.tsx resources/js/pages/admin/general.test.tsx resources/js/lib/admin/types.ts tests/Browser/Visual/AdminAndErrorPagesVisualTest.php
git commit -m "feat(admin): General no longer holds a maintenance message

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: The maintenance message leaves the server and the 503 page

**Files:**
- Modify: `app/Http/Controllers/Admin/GeneralSettingsController.php`
- Modify: `app/Http/Requests/Admin/GeneralSettingsUpdateRequest.php`
- Modify: `app/Enums/InstanceSettingKey.php`
- Modify: `app/Support/InstanceSettings.php`
- Modify: `app/Support/Maintenance/MaintenanceDetails.php`
- Modify: `resources/views/errors/503.blade.php`
- Modify: `resources/views/partials/static-page-head.blade.php`
- Test: `tests/Feature/MaintenanceDetailsTest.php`
- Test: `tests/Feature/ErrorPagesTest.php`
- Test: `tests/Feature/Admin/GeneralSettingsTest.php`
- Test: `tests/Feature/InstanceSettingsTest.php`
- Test: `tests/Browser/Visual/AdminAndErrorPagesVisualTest.php`
- Test: `tests/Browser/Walkthroughs/AdministrationTest.php`

**Interfaces:**
- Consumes: the front end of Task 4, which reads none of the three `maintenanceMessage*` props and sends no `maintenance_message`.
- Produces: `MaintenanceDetails::read()` returns `?array{backAt: ?string}`. `InstanceSettingKey` has no `MaintenanceMessage` and no `MaintenanceMessageBy` case. `AddMaintenanceDetailsListener` is unchanged.

- [ ] **Step 1: Rewrite the tests for what remains**

Replace the whole content of `tests/Feature/MaintenanceDetailsTest.php` with:

```php
<?php

use App\Support\Maintenance\MaintenanceDetails;

beforeEach(fn () => config(['app.maintenance.driver' => 'cache', 'app.maintenance.store' => 'array']));
afterEach(fn () => $this->artisan('up'));

it('attaches the time of return to the payload', function () {
    $this->travelTo(now()->setDateTime(2026, 10, 3, 14, 0, 0));

    $this->artisan('down', ['--retry' => 1800])->assertSuccessful();

    expect(resolve(MaintenanceDetails::class)->read())->toBe(['backAt' => '2026-10-03T14:30:00+00:00'])
        ->and(app()->maintenanceMode()->data()['retry'])->toBe(1800);
});

it('has no time of return without --retry', function () {
    $this->artisan('down')->assertSuccessful();

    expect(resolve(MaintenanceDetails::class)->read())->toBe(['backAt' => null]);
});

it('reads nothing outside maintenance', function () {
    expect(resolve(MaintenanceDetails::class)->read())->toBeNull();
});

it('reads only the time of return from a payload an earlier build wrote', function () {
    app()->maintenanceMode()->activate([
        'retry' => 600,
        MaintenanceDetails::PayloadKey => [
            'message' => 'Back soon.',
            'author' => 'Hugo Lambert',
            'backAt' => '2026-10-03T14:30:00+00:00',
        ],
    ]);

    expect(resolve(MaintenanceDetails::class)->read())->toBe(['backAt' => '2026-10-03T14:30:00+00:00']);
});
```

In `tests/Feature/ErrorPagesTest.php`:

1. Replace the test "shows the time of return and the admin message in maintenance" with:

```php
it('shows the time of return in maintenance, and no message an earlier build stored', function () {
    useProcessLocalMaintenanceMode();
    $this->travelTo(now()->setDateTime(2026, 10, 3, 12, 0, 0));
    InstanceSetting::query()->create(['key' => 'maintenance_message', 'value' => 'Mise à jour mensuelle.']);
    $this->artisan('down', ['--retry' => 1800]);

    try {
        $content = $this->get('/', ['Accept-Language' => 'fr'])->assertServiceUnavailable()->getContent();

        expect($content)
            ->toContain('data-slot="maintenance-back-at"')
            ->toContain('<time datetime="2026-10-03T12:30:00+00:00">12:30 UTC</time>')
            ->toContain('href="/status"')
            ->not->toContain('data-slot="maintenance-message"')
            ->not->toContain('Mise à jour mensuelle.')
            ->and(substr_count($content, '<script'))->toBe(1);
    } finally {
        $this->artisan('up');
    }
});
```

2. Rename "shows neither block without --retry and without a message" to `shows no time of return without --retry` and delete its line `->assertDontSee('data-slot="maintenance-message"', false)`.
3. Rename "shows neither block on the busy-database 503, even in maintenance" to `shows no time of return on the busy-database 503, even in maintenance`; delete its line `resolve(InstanceSettings::class)->set(InstanceSettingKey::MaintenanceMessage->value, 'Back soon.');` and its line `->assertDontSee('data-slot="maintenance-message"', false);`, then end the chain on the line above with `;`.
4. In the imports, delete `use App\Enums\InstanceSettingKey;` and `use App\Support\InstanceSettings;` and add `use App\Models\InstanceSetting;` in alphabetical place.

In `tests/Feature/Admin/GeneralSettingsTest.php`:

1. Delete the four tests "keeps the author of the maintenance message and audits the change", "keeps the author of an unchanged maintenance message saved by another admin", "clears the maintenance message and its author" and "shows the author and the date of the saved maintenance message".
2. Add in their place:

```php
it('stores nothing for a maintenance message, which the instance no longer has', function () {
    $this->put(route('admin.general.update'), ['maintenance_message' => 'Back soon.', 'signup_mode' => 'open'])
        ->assertRedirect(route('admin.general.edit'));

    expect(InstanceSetting::query()->whereIn('key', ['maintenance_message', 'maintenance_message_by'])->exists())->toBeFalse()
        ->and(AuditEvent::query()->where('action', AuditAction::SettingsUpdated)->sole()->properties)
        ->toBeIgnoringKeyOrder(['section' => 'general', 'keys' => ['signup_mode']]);
});
```

3. Add `use App\Models\InstanceSetting;` to the imports, after `use App\Models\AuditEvent;`.

In `tests/Feature/InstanceSettingsTest.php`:

1. In "lists every setting with its effective value", delete the two lines `'maintenance_message' => null,` and `'maintenance_message_by' => null,`.
2. Delete the test "refuses a maintenance message longer than 280 characters".

In `tests/Browser/Visual/AdminAndErrorPagesVisualTest.php`:

1. In "renders the admin sections without overflow", delete from the `setMany([...])` call the two lines keyed `InstanceSettingKey::MaintenanceMessage->value` and `InstanceSettingKey::MaintenanceMessageBy->value`.
2. Rename "renders the maintenance page with its time of return and message without overflow" to `renders the maintenance page with its time of return without overflow`. In it, replace `$admin = adminAndErrorVisualInstance();` with `adminAndErrorVisualInstance();`, delete the `resolve(InstanceSettings::class)->setMany([...]);` statement, and replace

```php
                $page = visit($path, $options)
                    ->assertPresent('[data-slot="maintenance-back-at"]')
                    ->assertPresent('[data-slot="maintenance-message"]');
```

with

```php
                $page = visit($path, $options)
                    ->assertPresent('[data-slot="maintenance-back-at"]');
```

In `tests/Browser/Walkthroughs/AdministrationTest.php`, rename "shows the time of return and the message of the admin on the maintenance page, and the status page in maintenance" to `shows the time of return on the maintenance page, and the status page in maintenance`. In it, replace `['admin' => $admin] = adminInstance();` with `adminInstance();`, delete the `resolve(InstanceSettings::class)->setMany([...]);` statement, and delete the two lines `->assertSeeIn('[data-slot="maintenance-message"]', …)`.

- [ ] **Step 2: Run the feature tests and see them fail**

Run: `php artisan test --compact tests/Feature/MaintenanceDetailsTest.php tests/Feature/ErrorPagesTest.php tests/Feature/Admin/GeneralSettingsTest.php tests/Feature/InstanceSettingsTest.php`
Expected: FAIL. `MaintenanceDetails::read()` still returns `message` and `author`; the PUT still stores `maintenance_message`; `all()` still lists the two keys.

- [ ] **Step 3: Remove the message from the controller and the request**

Replace the whole content of `app/Http/Controllers/Admin/GeneralSettingsController.php` with:

```php
<?php

namespace App\Http\Controllers\Admin;

use App\Actions\Admin\RecordAuditEvent;
use App\Enums\AuditAction;
use App\Enums\InstanceSettingKey;
use App\Enums\SignupMode;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\GeneralSettingsUpdateRequest;
use App\Support\InstanceSettings;
use App\Support\InstanceVersion;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

class GeneralSettingsController extends Controller
{
    /** @var array<int, InstanceSettingKey> */
    private const array Keys = [
        InstanceSettingKey::SignupMode,
        InstanceSettingKey::AllowedEmailDomains,
        InstanceSettingKey::UpdateCheckEnabled,
    ];

    public function edit(InstanceSettings $settings, InstanceVersion $version): Response
    {
        return Inertia::render('admin/general', [
            'signupMode' => $settings->signupMode(),
            'allowedEmailDomains' => $settings->allowedEmailDomains(),
            'defaults' => [
                'signupMode' => SignupMode::fromConfig()->value,
                'allowedEmailDomains' => array_values(config('skrum.allowed_email_domains')),
            ],
            'updateCheckEnabled' => $settings->updateCheckEnabled(),
            'version' => $version->current(),
            'versionStatus' => $version->status(),
            'image' => (string) config('skrum.image'),
        ]);
    }

    public function update(GeneralSettingsUpdateRequest $request, InstanceSettings $settings, RecordAuditEvent $recordAuditEvent): RedirectResponse
    {
        $values = $request->safe()->only([
            InstanceSettingKey::SignupMode->value,
            InstanceSettingKey::AllowedEmailDomains->value,
            InstanceSettingKey::UpdateCheckEnabled->value,
        ]);

        $updateCheckTurnedOn = DB::transaction(function () use ($request, $settings, $recordAuditEvent, $values): bool {
            $before = $this->current($settings);

            $settings->setMany($values);

            $after = $this->current($settings);
            $changed = array_keys(array_filter($after, fn (mixed $value, string $key): bool => $value !== $before[$key], ARRAY_FILTER_USE_BOTH));

            if ($changed !== []) {
                $recordAuditEvent->handle(AuditAction::SettingsUpdated, $request->user(), null, ['section' => 'general', 'keys' => $changed]);
            }

            return ! $before[InstanceSettingKey::UpdateCheckEnabled->value] && $after[InstanceSettingKey::UpdateCheckEnabled->value];
        });

        if ($updateCheckTurnedOn) {
            Artisan::queue('skrum:check-for-update');
        }

        Inertia::flash('toast', ['type' => 'success', 'message' => __('General settings saved.')]);

        return to_route('admin.general.edit');
    }

    /** @return array<string, mixed> */
    private function current(InstanceSettings $settings): array
    {
        $all = $settings->all();

        return collect(self::Keys)
            ->mapWithKeys(fn (InstanceSettingKey $key): array => [$key->value => $all[$key->value]])
            ->all();
    }
}
```

In `app/Http/Requests/Admin/GeneralSettingsUpdateRequest.php`, delete the rule line:

```php
            'maintenance_message' => ['sometimes', 'nullable', 'string', 'max:'.InstanceSettings::MaintenanceMessageMaxLength],
```

The import `use App\Support\InstanceSettings;` stays: `after()` uses it.

- [ ] **Step 4: Remove the setting**

In `app/Enums/InstanceSettingKey.php`, delete:

```php
    case MaintenanceMessage = 'maintenance_message';
    case MaintenanceMessageBy = 'maintenance_message_by';
```

In `app/Support/InstanceSettings.php`:

1. Delete the constant `public const int MaintenanceMessageMaxLength = 280;` and the blank line after it.
2. Delete the two methods:

```php
    public function maintenanceMessage(): ?string
    {
        return $this->storedString(InstanceSettingKey::MaintenanceMessage);
    }

    public function maintenanceMessageBy(): ?string
    {
        return $this->storedString(InstanceSettingKey::MaintenanceMessageBy);
    }
```

3. In the docblock of `all()`, delete the lines `*     maintenance_message: ?string,` and `*     maintenance_message_by: ?string,`.
4. In `all()`, delete the two entries keyed `InstanceSettingKey::MaintenanceMessage->value` and `InstanceSettingKey::MaintenanceMessageBy->value`.
5. In `normalise()`, delete the match arm `InstanceSettingKey::MaintenanceMessage => $this->messageFrom($key, $value),`.
6. Delete the method `messageFrom()`:

```php
    private function messageFrom(InstanceSettingKey $key, mixed $value): string
    {
        $message = $this->stringFrom($key, $value);

        if (mb_strlen($message) > self::MaintenanceMessageMaxLength) {
            throw new InvalidArgumentException("Instance setting [{$key->value}] is too long.");
        }

        return $message;
    }
```

`stringFrom()` stays: the GIF key and the sign-up mode use it.

- [ ] **Step 5: Keep only the time of return in the maintenance payload**

Replace the whole content of `app/Support/Maintenance/MaintenanceDetails.php` with:

```php
<?php

namespace App\Support\Maintenance;

class MaintenanceDetails
{
    public const string PayloadKey = 'skrum';

    /**
     * Runs right after `artisan down` wrote its payload.
     *
     * @param  array<string, mixed>  $payload
     * @return array<string, mixed>
     */
    public function attachTo(array $payload): array
    {
        $retry = $payload['retry'] ?? null;

        return [...$payload, self::PayloadKey => [
            'backAt' => is_int($retry) && $retry > 0 ? now('UTC')->addSeconds($retry)->toIso8601String() : null,
        ]];
    }

    /**
     * Read by the static 503 page: no database, and nothing thrown.
     *
     * @return ?array{backAt: ?string}
     */
    public function read(): ?array
    {
        return rescue(function (): ?array {
            if (! app()->isDownForMaintenance()) {
                return null;
            }

            $details = app()->maintenanceMode()->data()[self::PayloadKey] ?? null;

            if (! is_array($details)) {
                return null;
            }

            return ['backAt' => $this->stringOrNull($details['backAt'] ?? null)];
        }, null, report: false);
    }

    private function stringOrNull(mixed $value): ?string
    {
        return is_string($value) ? $value : null;
    }
}
```

- [ ] **Step 6: Remove the message block from the 503 page**

In `resources/views/errors/503.blade.php`:

1. In the header comment, replace

```
    In maintenance it shows when the instance is due back (`artisan down
    --retry`) and the message the admin prepared, both read from the
    maintenance payload, never from the database; the busy page shows neither.
```

with

```
    In maintenance it shows when the instance is due back (`artisan down
    --retry`), read from the maintenance payload, never from the database;
    the busy page does not.
```

2. In the `@php` block, delete the lines `$message = $details['message'] ?? null;` and `$author = $details['author'] ?? null;`, and the five-line statement that starts with `$authorInitials = $author === null ? '' : collect(` and ends with `->implode('');`.
3. Delete the block:

```blade
            @if($message !== null)
                <figure class="message" data-slot="maintenance-message">
                    <blockquote>{{ __('“:message”', ['message' => $message], $locale) }}</blockquote>
                    @if($author !== null)
                        <figcaption><span class="avatar" aria-hidden="true">{{ $authorInitials }}</span>{{ __(':name, instance admin', ['name' => $author], $locale) }}</figcaption>
                    @endif
                </figure>
            @endif
```

In `resources/views/partials/static-page-head.blade.php`, delete the four rules `.message`, `.message blockquote`, `.message figcaption` and `.avatar` (from the line `.message {` to the closing brace of `.avatar`, with the blank line that follows), leaving `.back-at-zone[hidden]` followed by one blank line and `footer {`. Check first that nothing else uses them:

Run: `grep -rnE 'class="[^"]*\b(message|avatar)\b' resources/views/errors resources/views/status.blade.php resources/views/partials`
Expected: no line once the block of step 3 is gone.

- [ ] **Step 7: Run the feature tests and see them pass**

Run:

```bash
vendor/bin/pint --dirty --format agent
php artisan test --compact tests/Feature/MaintenanceDetailsTest.php tests/Feature/ErrorPagesTest.php tests/Feature/Admin/GeneralSettingsTest.php tests/Feature/InstanceSettingsTest.php tests/Feature/Admin/UpdateChecksTest.php tests/Feature/TranslationKeysTest.php
composer types:check
```

Expected: all PASS, PHPStan reports no error.

- [ ] **Step 8: Confirm nothing in the application still names the message**

Run: `grep -rnE "MaintenanceMessage|maintenanceMessage|maintenance-message" app resources/js resources/views tests --include='*.php' --include='*.tsx' --include='*.ts' | grep -v "resources/js/actions\|resources/js/routes\|resources/js/wayfinder"`
Expected: no output.

Run: `grep -rn "maintenance_message" app resources/js resources/views tests`
Expected: only `resources/js/components/admin/audit-log/audit-action-label.tsx`, its test, and the three test lines written in Step 1 (`ErrorPagesTest`, `GeneralSettingsTest`).

- [ ] **Step 9: Commit**

```bash
git add app resources/views tests/Feature tests/Browser/Visual/AdminAndErrorPagesVisualTest.php tests/Browser/Walkthroughs/AdministrationTest.php
git commit -m "feat(maintenance): the 503 page shows the time of return and no message

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Translations no line uses, the README, and the whole suite

**Files:**
- Modify: `lang/en.json`, `lang/fr.json`, `lang/es.json`, `lang/de.json`
- Modify: `README.md` (one sentence in "Upgrading")
- Modify: `tests/visual/__screenshots__/admin-general-page-light-1440-fr.png`, `tests/visual/__screenshots__/access-error-503-maintenance-page-light-1440-fr.png` (regenerated)

**Interfaces:**
- Consumes: Tasks 1 to 5.
- Produces: nothing.

- [ ] **Step 1: Confirm the six keys have no user left**

Run:

```bash
grep -rnF -e "A note for everyone while the instance is down for maintenance." -e "Shown on the maintenance page from the next :command." -e "Keep the message to :max characters." -e "Saved by :name, :date" -e ":name, instance admin" app resources/js resources/views
grep -rnE "t\('Message'\)|__\('Message'" app resources/js resources/views
```

Expected: no output from either. If a line appears, leave that key out of the next step.

- [ ] **Step 2: Remove them from the four files**

Run:

```bash
python3 - <<'EOF'
import json
import pathlib

orphans = [
    'A note for everyone while the instance is down for maintenance.',
    'Shown on the maintenance page from the next :command.',
    'Keep the message to :max characters.',
    'Message',
    'Saved by :name, :date',
    ':name, instance admin',
]

for locale in ['en', 'fr', 'es', 'de']:
    path = pathlib.Path(f'lang/{locale}.json')
    current = json.loads(path.read_text(encoding='utf-8'))
    for key in orphans:
        assert key in current, f'{locale}: {key} missing'
    kept = {key: value for key, value in current.items() if key not in orphans}
    path.write_text(json.dumps(kept, ensure_ascii=False, indent=4) + '\n', encoding='utf-8')
EOF
git diff --stat lang/
```

Expected: four files, 6 deletions each. `Maintenance message`, `Clear` and `“:message”` stay: the audit log, six other components and the invitation mail use them.

- [ ] **Step 3: Correct the README**

In `README.md`, section "Upgrading", replace

```
The page shows the time of return taken from `--retry`, and the maintenance message saved in Administration › General (the message in force when `down` runs, with its author); it reloads by itself every 30 seconds and links to the status page.
```

with

```
The page shows the time of return taken from `--retry`; it reloads by itself every 30 seconds and links to the status page.
```

- [ ] **Step 4: Run the whole check**

Run: `composer ci:check`
Expected: PASS. It runs `npm run check`, `npm run types:check`, Pint, PHPStan and the Pest suite in parallel.

- [ ] **Step 5: Run the touched tests on the two reference engines**

Run:

```bash
bin/test-db pgsql -- tests/Feature/Admin/GeneralSettingsTest.php tests/Feature/InstanceSettingsTest.php tests/Feature/ErrorPagesTest.php tests/Feature/MaintenanceDetailsTest.php tests/Feature/Support/InstanceVersionTest.php
bin/test-db mariadb -- tests/Feature/Admin/GeneralSettingsTest.php tests/Feature/InstanceSettingsTest.php tests/Feature/ErrorPagesTest.php tests/Feature/MaintenanceDetailsTest.php tests/Feature/Support/InstanceVersionTest.php
```

Expected: PASS on both (rule 12 of `docs/database.md`). They need the Sail database containers.

- [ ] **Step 6: Run the browser tests of the changed pages and take the pictures again**

A run of a visual test rewrites its baseline when the picture differs; there is no separate update command.

Run:

```bash
npm run build
DB_CONNECTION=pgsql DB_DATABASE=testing vendor/bin/pest tests/Browser/Visual/AdminAndErrorPagesVisualTest.php --filter="renders the admin sections without overflow|renders the maintenance page with its time of return without overflow"
DB_CONNECTION=pgsql DB_DATABASE=testing vendor/bin/pest tests/Browser/Walkthroughs/AdministrationTest.php tests/Browser/Walkthroughs/CoverageAccountTest.php
```

Expected: PASS. `git status --short tests/visual/__screenshots__ | grep -E "admin-general-page|access-error-503-maintenance-page"` lists the regenerated pictures.

- [ ] **Step 7: Look at the two pictures**

Open `tests/visual/__screenshots__/admin-general-page-light-1440-fr.png` and `tests/visual/__screenshots__/access-error-503-maintenance-page-light-1440-fr.png`.
Expected: the first shows the Updates card with "Comment mettre à jour" closed and no maintenance card; the second shows the time of return and no quoted message.

- [ ] **Step 8: Commit**

Only the two baselines git already tracks for these pages are added; the working tree holds many other regenerated pictures that belong to other work.

```bash
git add lang/en.json lang/fr.json lang/es.json lang/de.json README.md tests/visual/__screenshots__/admin-general-page-light-1440-fr.png tests/visual/__screenshots__/access-error-503-maintenance-page-light-1440-fr.png
git commit -m "chore(maintenance): the translations and the README forget the maintenance message

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Self-review

| Spec item | Where |
| --- | --- |
| §5.1 `releaseUrl`, `skrum.image`, page prop `image` | Task 1 |
| §5.2 release link, disclosure, three tabs, steps, copy, placeholder | Task 2 |
| §5.3 sidebar link | Task 3 |
| §5.4 MCP sentence | Task 3 |
| §5.5 removed: card, form field, props, controller, request, enum, settings, payload, 503 block and styles | Tasks 4 and 5 |
| §5.5 removed: translations, README | Task 6 |
| §5.5 kept: listener, `backAt`, audit label | Task 5 (untouched, checked in Step 8) |
| §5.5 no migration, stale rows and payload ignored | Task 5 tests |
| AC1, AC2 | Task 2 card tests |
| AC3 | Task 2 component tests (steps and commands of each tab, placeholder) |
| AC4 | Task 2 "copies the exact command…", "is driven by the keyboard alone" |
| AC5 | Task 3 admin-shell test |
| AC6 | Task 3 MCP test |
| AC7 | Task 4 "offers no maintenance message", Task 5 "stores nothing for a maintenance message…" |
| AC8 | Task 5 "shows the time of return in maintenance, and no message an earlier build stored" |
| AC9 | Task 5 "reads only the time of return from a payload an earlier build wrote" |
| AC10 | `audit-action-label.test.tsx`, unchanged and run in Task 4 Step 5 |
| AC11 | Task 2 Step 9, Task 3 Step 4, Task 6 Steps 1 and 2, `TranslationKeysTest` |
| AC12 | Task 6 Steps 4 to 7 |
