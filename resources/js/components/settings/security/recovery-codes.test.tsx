import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { RecoveryCodes } from './recovery-codes';

const page = vi.hoisted(() => ({ props: {} as Record<string, unknown> }));

vi.mock('@inertiajs/react', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@inertiajs/react')>()),
    usePage: () => page,
}));

const codes = ['aaaaa-bbbbb', 'ccccc-ddddd', 'eeeee-fffff'];

beforeEach(() => {
    page.props = { translations: {} };
});

describe('RecoveryCodes', () => {
    it('lists the codes in order, each with its number', () => {
        renderWithProviders(<RecoveryCodes codes={codes} />);

        const items = within(
            screen.getByRole('list', { name: 'Recovery codes' }),
        ).getAllByRole('listitem');

        expect(items.map((item) => item.textContent)).toEqual([
            '01aaaaa-bbbbb',
            '02ccccc-ddddd',
            '03eeeee-fffff',
        ]);
    });

    it('offers Download .txt and Copy, and no Print', () => {
        renderWithProviders(<RecoveryCodes codes={codes} />);

        expect(
            screen.getAllByRole('button').map((button) => button.textContent),
        ).toEqual(['Download .txt', 'Copy']);
    });

    it('copies the codes, one per line, and says so', async () => {
        const user = userEvent.setup();
        const writeText = vi
            .spyOn(navigator.clipboard, 'writeText')
            .mockResolvedValue();

        renderWithProviders(<RecoveryCodes codes={codes} />);

        await user.click(screen.getByRole('button', { name: 'Copy' }));

        expect(writeText).toHaveBeenCalledWith(codes.join('\n'));
        expect(
            await screen.findByRole('button', { name: 'Copied' }),
        ).toBeTruthy();
    });

    it('downloads the codes as a text file', async () => {
        const blobs: Blob[] = [];
        const create = vi.fn((blob: Blob) => {
            blobs.push(blob);

            return 'blob:codes';
        });
        const revoke = vi.fn();
        const clicked: string[] = [];

        vi.stubGlobal('URL', {
            ...URL,
            createObjectURL: create,
            revokeObjectURL: revoke,
        });
        vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(
            function (this: HTMLAnchorElement) {
                clicked.push(this.download);
            },
        );

        renderWithProviders(<RecoveryCodes codes={codes} />);

        await userEvent.click(
            screen.getByRole('button', { name: 'Download .txt' }),
        );

        expect(clicked).toEqual(['recovery-codes.txt']);
        expect(await blobs[0].text()).toBe(`${codes.join('\n')}\n`);
        expect(revoke).toHaveBeenCalledWith('blob:codes');

        vi.unstubAllGlobals();
    });

    it('shows a placeholder and disables its actions while the codes are fetched', () => {
        renderWithProviders(
            <RecoveryCodes codes={[]} loading placeholders={8} />,
        );

        expect(
            screen.getByRole('status', { name: 'Loading recovery codes' })
                .children.length,
        ).toBe(8);
        expect(screen.queryByRole('list')).toBeNull();
        expect(
            screen
                .getAllByRole('button')
                .every((button) => button.hasAttribute('disabled')),
        ).toBe(true);
    });

    it('does not announce a loading that is over when the answer holds no code', () => {
        renderWithProviders(<RecoveryCodes codes={[]} />);

        expect(screen.queryByRole('status')).toBeNull();
        expect(screen.queryByRole('list')).toBeNull();
        expect(
            screen
                .getAllByRole('button')
                .every((button) => button.hasAttribute('disabled')),
        ).toBe(true);
    });
});
