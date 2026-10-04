import { act, fireEvent, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ActionItemSearchField } from '@/components/action-items/action-item-search-field';
import { renderWithProviders } from '@/test/render';

describe('ActionItemSearchField', () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    const field = () =>
        screen.getByRole('searchbox', { name: 'Search action items' });

    it('shows the mockup placeholder and the shortcut', () => {
        renderWithProviders(
            <ActionItemSearchField value={null} onSearch={vi.fn()} />,
        );

        expect(field().getAttribute('placeholder')).toBe(
            'Search an action item, a ticket…',
        );
        expect(screen.getByText(/K$/)).toBeTruthy();
    });

    it('applies the term 300 ms after the last key, trimmed', () => {
        const onSearch = vi.fn();
        renderWithProviders(
            <ActionItemSearchField value={null} onSearch={onSearch} />,
        );

        fireEvent.change(field(), { target: { value: 'run' } });
        act(() => {
            vi.advanceTimersByTime(200);
        });
        fireEvent.change(field(), { target: { value: 'runbook ' } });
        act(() => {
            vi.advanceTimersByTime(299);
        });

        expect(onSearch).not.toHaveBeenCalled();

        act(() => {
            vi.advanceTimersByTime(1);
        });

        expect(onSearch).toHaveBeenCalledExactlyOnceWith('runbook');
    });

    it('applies at once on Enter, and Escape clears', () => {
        const onSearch = vi.fn();
        renderWithProviders(
            <ActionItemSearchField value="runbook" onSearch={onSearch} />,
        );

        fireEvent.change(field(), { target: { value: 'wiki' } });
        fireEvent.keyDown(field(), { key: 'Enter' });

        expect(onSearch).toHaveBeenLastCalledWith('wiki');

        fireEvent.keyDown(field(), { key: 'Escape' });

        expect(onSearch).toHaveBeenLastCalledWith(null);
        expect((field() as HTMLInputElement).value).toBe('');
    });

    it('does not search again on Enter when the term was already sent', () => {
        const onSearch = vi.fn();
        renderWithProviders(
            <ActionItemSearchField value="runbook" onSearch={onSearch} />,
        );

        fireEvent.keyDown(field(), { key: 'Enter' });

        expect(onSearch).not.toHaveBeenCalled();
    });

    it('focuses on mod+K, a field included, unless its shortcut is off', () => {
        const { unmount } = renderWithProviders(
            <>
                <input aria-label="Other" />
                <ActionItemSearchField value={null} onSearch={vi.fn()} />
            </>,
        );

        screen.getByLabelText('Other').focus();
        fireEvent.keyDown(screen.getByLabelText('Other'), {
            key: 'k',
            metaKey: true,
            ctrlKey: true,
        });

        expect(document.activeElement).toBe(field());

        unmount();
        renderWithProviders(
            <ActionItemSearchField
                value={null}
                onSearch={vi.fn()}
                shortcut={false}
            />,
        );
        fireEvent.keyDown(document.body, {
            key: 'k',
            metaKey: true,
            ctrlKey: true,
        });

        expect(document.activeElement).not.toBe(field());
    });

    it('applies a pending term on unmount only when asked', () => {
        const onSearch = vi.fn();
        const first = renderWithProviders(
            <ActionItemSearchField value={null} onSearch={onSearch} />,
        );

        fireEvent.change(field(), { target: { value: 'wiki' } });
        first.unmount();

        expect(onSearch).not.toHaveBeenCalled();

        const second = renderWithProviders(
            <ActionItemSearchField
                value={null}
                onSearch={onSearch}
                submitPendingOnUnmount
            />,
        );

        second.unmount();

        expect(onSearch).not.toHaveBeenCalled();

        const third = renderWithProviders(
            <ActionItemSearchField
                value={null}
                onSearch={onSearch}
                submitPendingOnUnmount
            />,
        );

        fireEvent.change(field(), { target: { value: 'wiki ' } });
        third.unmount();

        expect(onSearch).toHaveBeenCalledExactlyOnceWith('wiki');
    });

    it('takes a value changed elsewhere (Reset) without losing what is being typed', () => {
        const onSearch = vi.fn();
        const { rerender } = renderWithProviders(
            <ActionItemSearchField value={null} onSearch={onSearch} />,
        );

        fireEvent.change(field(), { target: { value: 'runbook' } });
        act(() => {
            vi.advanceTimersByTime(300);
        });
        fireEvent.change(field(), { target: { value: 'runbook wiki' } });
        rerender(<ActionItemSearchField value="runbook" onSearch={onSearch} />);

        expect((field() as HTMLInputElement).value).toBe('runbook wiki');

        rerender(<ActionItemSearchField value={null} onSearch={onSearch} />);

        expect((field() as HTMLInputElement).value).toBe('');
    });
});
