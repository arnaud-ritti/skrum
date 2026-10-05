import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { BuilderTopbar } from '@/components/surveys/builder-topbar';
import type { BuilderTopbarProps } from '@/components/surveys/builder-topbar';
import { renderWithProviders } from '@/test/render';

function renderTopbar(overrides: Partial<BuilderTopbarProps> = {}) {
    const props: BuilderTopbarProps = {
        status: 'draft',
        saveState: { status: 'idle' },
        lastSavedAt: null,
        questionCount: 3,
        hasAnswers: false,
        resultsHref: '/surveys/s-1/results',
        busy: false,
        onPreview: undefined,
        onPublish: vi.fn(),
        onBackToDraft: vi.fn(),
        ...overrides,
    };

    renderWithProviders(<BuilderTopbar {...props} />);

    return props;
}

function button(name: string): HTMLButtonElement {
    return screen.getByRole('button', { name }) as HTMLButtonElement;
}

describe('BuilderTopbar', () => {
    it('shows a draft with Preview and Publish', () => {
        const props = renderTopbar();

        expect(button('Preview').disabled).toBe(true);

        fireEvent.click(button('Publish'));

        expect(props.onPublish).toHaveBeenCalled();
        expect(
            screen.queryByRole('button', { name: 'Back to draft' }),
        ).toBeNull();
        expect(screen.queryByRole('link', { name: 'View results' })).toBeNull();
    });

    it('opens the preview when one is given', () => {
        const onPreview = vi.fn();

        renderTopbar({ onPreview });
        fireEvent.click(button('Preview'));

        expect(onPreview).toHaveBeenCalled();
    });

    it('disables Publish without a question', () => {
        renderTopbar({ questionCount: 0 });

        expect(button('Publish').disabled).toBe(true);
    });

    it('offers Back to draft on an open survey nobody answered, and the results', () => {
        const props = renderTopbar({ status: 'open' });

        expect(screen.queryByRole('button', { name: 'Publish' })).toBeNull();
        expect(
            screen
                .getByRole('link', { name: 'View results' })
                .getAttribute('href'),
        ).toBe('/surveys/s-1/results');

        fireEvent.click(button('Back to draft'));

        expect(props.onBackToDraft).toHaveBeenCalled();
    });

    it('offers no Back to draft once someone answered', () => {
        renderTopbar({ status: 'open', hasAnswers: true });

        expect(
            screen.queryByRole('button', { name: 'Back to draft' }),
        ).toBeNull();
    });

    it('shows the results of a closed survey', () => {
        renderTopbar({ status: 'closed', hasAnswers: true });

        expect(screen.getByRole('link', { name: 'View results' })).toBeTruthy();
    });

    it('says when the survey was last saved before any save of this visit', () => {
        renderTopbar({ lastSavedAt: Date.now() - 4000 });

        expect(screen.getByText('Saved 4 sec ago')).toBeTruthy();
    });

    it('announces the save state without its ticking elapsed time', () => {
        renderTopbar({ saveState: { status: 'saved', at: Date.now() - 4000 } });

        expect(screen.getByRole('status').textContent).toBe('Saved');
        expect(
            screen.getByText('Saved 4 sec ago').closest('[aria-hidden]'),
        ).not.toBeNull();
    });

    it('leaves the badge of the status to the breadcrumb', () => {
        renderTopbar();

        expect(screen.queryByText('Draft')).toBeNull();
    });

    it('says saving, saved and not saved', () => {
        renderTopbar({ saveState: { status: 'saving' } });

        expect(screen.getByRole('status').textContent).toBe('Saving…');

        renderTopbar({ saveState: { status: 'saved', at: Date.now() - 4000 } });

        expect(screen.getAllByRole('status')[1].textContent).toBe('Saved');

        renderTopbar({ saveState: { status: 'error', message: 'Nope' } });

        expect(screen.getAllByRole('status')[2].textContent).toBe('Not saved');
    });
});
