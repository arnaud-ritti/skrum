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
