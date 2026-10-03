import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { ResultsHeader } from './results-header';

const exportUrl = '/surveys/survey-1/export';

describe('ResultsHeader', () => {
    it('shows an open survey with a live dot, and lets an editor close it after a confirmation', async () => {
        const onSetStatus = vi.fn().mockResolvedValue(undefined);

        renderWithProviders(
            <ResultsHeader
                status="open"
                isEditor
                canExport={false}
                exportUrl={exportUrl}
                onSetStatus={onSetStatus}
            />,
        );

        const badge = screen.getByText('Open').closest('[data-slot="badge"]');

        expect(badge?.querySelector('[data-slot="badge-dot"]')).not.toBeNull();
        expect(screen.queryByRole('link', { name: 'Export CSV' })).toBeNull();
        expect(screen.queryByRole('button', { name: 'Reopen' })).toBeNull();

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

    it('shows a closed survey, with the export link and Reopen for an editor', async () => {
        const onSetStatus = vi.fn().mockResolvedValue(undefined);

        renderWithProviders(
            <ResultsHeader
                status="closed"
                isEditor
                canExport
                exportUrl={exportUrl}
                onSetStatus={onSetStatus}
            />,
        );

        const badge = screen
            .getByText('Survey closed')
            .closest('[data-slot="badge"]');

        expect(badge?.querySelector('svg')).not.toBeNull();
        expect(
            screen
                .getByRole('link', { name: 'Export CSV' })
                .getAttribute('href'),
        ).toBe(exportUrl);
        expect(
            screen.queryByRole('button', { name: 'Close the survey' }),
        ).toBeNull();

        fireEvent.click(screen.getByRole('button', { name: 'Reopen' }));

        await waitFor(() => expect(onSetStatus).toHaveBeenCalledWith('open'));
    });

    it('keeps the actions to their icons on a phone, under their full names, and the status in words', () => {
        renderWithProviders(
            <ResultsHeader
                status="closed"
                isEditor
                canExport
                exportUrl={exportUrl}
                onSetStatus={vi.fn()}
            />,
        );

        for (const action of [
            screen.getByRole('link', { name: 'Export CSV' }),
            screen.getByRole('button', { name: 'Reopen' }),
        ]) {
            expect(action.querySelector('span')?.className).toContain(
                'max-md:sr-only',
            );
        }

        expect(screen.getByText('Survey closed').className).not.toContain(
            'sr-only',
        );
    });

    it('gives a viewer who does not edit the status only', () => {
        renderWithProviders(
            <ResultsHeader
                status="closed"
                isEditor={false}
                canExport={false}
                exportUrl={exportUrl}
                onSetStatus={vi.fn()}
            />,
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
