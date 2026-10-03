import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { ResultsHeader, ResultsStatus } from './results-header';

const exportUrl = '/surveys/survey-1/export';

describe('ResultsHeader', () => {
    it('shows an open survey with a live dot, and lets an editor close it after a confirmation', async () => {
        const onSetStatus = vi.fn().mockResolvedValue(undefined);

        renderWithProviders(
            <>
                <ResultsStatus status="open" />
                <ResultsHeader
                    status="open"
                    isEditor
                    canExport={false}
                    exportUrl={exportUrl}
                    onSetStatus={onSetStatus}
                />
            </>,
        );

        const badge = screen.getByText('Open').closest('[data-slot="badge"]');

        expect(badge?.querySelector('[data-slot="badge-dot"]')).not.toBeNull();
        expect(screen.queryByRole('link', { name: 'Export CSV' })).toBeNull();
        expect(screen.queryByRole('button', { name: 'Reopen' })).toBeNull();
        expect(
            screen.queryByRole('button', { name: 'More actions' }),
        ).toBeNull();

        fireEvent.click(
            screen.getByRole('button', { name: 'Close the survey' }),
        );

        const dialog = await screen.findByRole('alertdialog');

        expect(within(dialog).getByText('Close the survey?')).not.toBeNull();
        expect(
            within(dialog).getByText(
                'People can no longer answer. You can reopen it.',
            ),
        ).not.toBeNull();
        expect(onSetStatus).not.toHaveBeenCalled();

        fireEvent.click(
            within(dialog).getByRole('button', { name: 'Close the survey' }),
        );

        await waitFor(() => expect(onSetStatus).toHaveBeenCalledWith('closed'));
    });

    it('keeps the dialog open with the error when closing fails', async () => {
        const onSetStatus = vi.fn().mockRejectedValue(new Error('Gone wrong'));

        renderWithProviders(
            <ResultsHeader
                status="open"
                isEditor
                canExport={false}
                exportUrl={exportUrl}
                onSetStatus={onSetStatus}
            />,
        );

        fireEvent.click(
            screen.getByRole('button', { name: 'Close the survey' }),
        );
        const dialog = await screen.findByRole('alertdialog');

        fireEvent.click(
            within(dialog).getByRole('button', { name: 'Close the survey' }),
        );

        expect(
            (await within(dialog).findByRole('alert')).textContent,
        ).toContain('Something went wrong. Please try again.');
    });

    it('shows a closed survey with the export link and the share trigger only, Reopen in the "…" menu of an editor', async () => {
        const onSetStatus = vi.fn().mockResolvedValue(undefined);

        renderWithProviders(
            <>
                <ResultsStatus status="closed" />
                <ResultsHeader
                    status="closed"
                    isEditor
                    canExport
                    exportUrl={exportUrl}
                    onSetStatus={onSetStatus}
                    share={<button type="button">Share with the team</button>}
                />
            </>,
        );

        const badge = screen
            .getByText('Survey closed')
            .closest('[data-slot="badge"]');

        expect(badge?.querySelector('svg')).not.toBeNull();

        const header = document.querySelector(
            '[data-slot="survey-results-header"]',
        ) as HTMLElement;
        const export_ = within(header).getByRole('link', {
            name: 'Export CSV',
        });

        expect(export_.getAttribute('href')).toBe(exportUrl);
        expect(within(header).queryByText('Survey closed')).toBeNull();
        expect(
            within(header).queryByRole('button', { name: 'Reopen' }),
        ).toBeNull();
        expect(
            within(header).queryByRole('button', { name: 'Close the survey' }),
        ).toBeNull();
        expect(
            within(header)
                .getAllByRole('button')
                .map(
                    (button) =>
                        button.getAttribute('aria-label') ?? button.textContent,
                ),
        ).toEqual(['Share with the team', 'More actions']);

        const menu = within(header).getByRole('button', {
            name: 'More actions',
        });

        fireEvent.pointerDown(menu, { button: 0, ctrlKey: false });
        fireEvent.click(
            await screen.findByRole('menuitem', { name: 'Reopen' }),
        );

        await waitFor(() => expect(onSetStatus).toHaveBeenCalledWith('open'));
    });

    it('keeps the actions to their icons on a phone, under their full names', () => {
        renderWithProviders(
            <>
                <ResultsStatus status="closed" />
                <ResultsHeader
                    status="closed"
                    isEditor
                    canExport
                    exportUrl={exportUrl}
                    onSetStatus={vi.fn()}
                />
            </>,
        );

        expect(
            screen
                .getByRole('link', { name: 'Export CSV' })
                .querySelector('span')?.className,
        ).toContain('max-md:sr-only');
        expect(screen.getByText('Survey closed').className).not.toContain(
            'sr-only',
        );
    });

    it('gives a viewer who does not edit the status only', () => {
        renderWithProviders(
            <>
                <ResultsStatus status="closed" />
                <ResultsHeader
                    status="closed"
                    isEditor={false}
                    canExport={false}
                    exportUrl={exportUrl}
                    onSetStatus={vi.fn()}
                />
            </>,
        );

        expect(screen.getByText('Survey closed')).not.toBeNull();
        expect(screen.queryByRole('link')).toBeNull();
        expect(screen.queryByRole('button')).toBeNull();
    });

    it('places the share trigger it is given', () => {
        renderWithProviders(
            <ResultsHeader
                status="open"
                isEditor={false}
                canExport={false}
                exportUrl={exportUrl}
                onSetStatus={vi.fn()}
                share={<button type="button">Share</button>}
            />,
        );

        expect(screen.getByRole('button', { name: 'Share' })).not.toBeNull();
    });
});
