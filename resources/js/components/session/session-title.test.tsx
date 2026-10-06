import { fireEvent, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SessionTitle } from '@/components/session/session-title';
import { renderWithProviders } from '@/test/render';

describe('SessionTitle', () => {
    it('keeps the subtitle for the phone, under the title and out of the h1', () => {
        const { container } = renderWithProviders(
            <SessionTitle
                overline="Atlas · Retrospective"
                subtitle="Voting · 4/7"
            >
                Sprint 42
            </SessionTitle>,
        );
        const subtitle = container.querySelector(
            '[data-slot="session-subtitle"]',
        );

        expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(
            'Sprint 42',
        );
        expect(subtitle?.textContent).toBe('Voting · 4/7');
        expect(subtitle?.className).toContain('md:hidden');
        expect(
            screen
                .getByRole('heading', { level: 1 })
                .compareDocumentPosition(subtitle as Element) &
                Node.DOCUMENT_POSITION_FOLLOWING,
        ).toBeTruthy();
    });

    it('makes the back arrow a button when leaving has to be asked first', () => {
        const onBack = vi.fn();

        renderWithProviders(
            <SessionTitle backHref="/teams/t1" onBack={onBack}>
                Sprint 42
            </SessionTitle>,
        );

        expect(screen.queryByRole('link')).toBeNull();

        fireEvent.click(
            screen.getByRole('button', { name: 'Back to the team' }),
        );

        expect(onBack).toHaveBeenCalledTimes(1);
    });

    it('renames on Enter and on blur', async () => {
        const onRename = vi.fn();

        renderWithProviders(
            <SessionTitle onRename={onRename}>Sprint 42</SessionTitle>,
        );

        fireEvent.click(screen.getByRole('button', { name: 'Rename' }));

        const field = screen.getByRole('textbox', { name: 'Session name' });

        expect((field as HTMLInputElement).value).toBe('Sprint 42');
        expect(field.getAttribute('maxlength')).toBe('120');
        expect(document.activeElement).toBe(field);

        fireEvent.change(field, { target: { value: '  Sprint 43 ' } });
        fireEvent.keyDown(field, { key: 'Enter' });

        await waitFor(() => expect(screen.queryByRole('textbox')).toBeNull());
        expect(onRename).toHaveBeenLastCalledWith('Sprint 43');

        fireEvent.click(screen.getByRole('button', { name: 'Sprint 42' }));
        fireEvent.change(screen.getByRole('textbox'), {
            target: { value: 'Sprint 44' },
        });
        fireEvent.blur(screen.getByRole('textbox'));

        await waitFor(() => expect(screen.queryByRole('textbox')).toBeNull());
        expect(onRename).toHaveBeenLastCalledWith('Sprint 44');
        expect(onRename).toHaveBeenCalledTimes(2);
    });

    it('keeps the name on Esc', () => {
        const onRename = vi.fn();

        renderWithProviders(
            <SessionTitle onRename={onRename}>Sprint 42</SessionTitle>,
        );

        fireEvent.click(screen.getByRole('button', { name: 'Rename' }));

        const field = screen.getByRole('textbox', { name: 'Session name' });

        fireEvent.change(field, { target: { value: 'Another name' } });
        fireEvent.keyDown(field, { key: 'Escape' });
        fireEvent.blur(field);

        expect(screen.queryByRole('textbox')).toBeNull();
        expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(
            'Sprint 42',
        );
        expect(onRename).not.toHaveBeenCalled();
    });

    it('does not save an empty name', () => {
        const onRename = vi.fn();

        renderWithProviders(
            <SessionTitle onRename={onRename}>Sprint 42</SessionTitle>,
        );

        fireEvent.click(screen.getByRole('button', { name: 'Rename' }));

        const field = screen.getByRole<HTMLInputElement>('textbox');

        fireEvent.change(field, { target: { value: '   ' } });
        fireEvent.keyDown(field, { key: 'Enter' });

        expect(field.validationMessage).toBe('The name is required.');
        expect(field.getAttribute('aria-invalid')).toBe('true');

        fireEvent.change(field, { target: { value: 'S' } });

        expect(field.validationMessage).toBe('');
        expect(field.hasAttribute('aria-invalid')).toBe(false);

        fireEvent.change(field, { target: { value: '' } });
        fireEvent.blur(field);

        expect(screen.queryByRole('textbox')).toBeNull();
        expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(
            'Sprint 42',
        );
        expect(onRename).not.toHaveBeenCalled();
    });

    it('does not save an unchanged name', () => {
        const onRename = vi.fn();

        renderWithProviders(
            <SessionTitle onRename={onRename}>Sprint 42</SessionTitle>,
        );

        fireEvent.click(screen.getByRole('button', { name: 'Rename' }));
        fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter' });

        expect(screen.queryByRole('textbox')).toBeNull();
        expect(onRename).not.toHaveBeenCalled();
    });

    it('stays in edit mode with the field marked when the rename is refused', async () => {
        const onRename = vi.fn(async () => {
            throw new Error('refused');
        });

        renderWithProviders(
            <SessionTitle onRename={onRename}>Sprint 42</SessionTitle>,
        );

        fireEvent.click(screen.getByRole('button', { name: 'Rename' }));

        const field = screen.getByRole<HTMLInputElement>('textbox');

        fireEvent.change(field, { target: { value: 'Sprint 43' } });
        fireEvent.keyDown(field, { key: 'Enter' });

        await waitFor(() =>
            expect(field.getAttribute('aria-invalid')).toBe('true'),
        );
        expect(field.value).toBe('Sprint 43');
        expect(field.hasAttribute('readonly')).toBe(false);
    });

    it('names the pencil and the field as the session asks, with its limit', () => {
        renderWithProviders(
            <SessionTitle
                onRename={() => {}}
                renameLabel="Rename the board"
                nameLabel="Board name"
                nameMaxLength={60}
            >
                Sprint board
            </SessionTitle>,
        );

        const pencil = screen.getByRole('button', {
            name: 'Rename the board',
        });

        expect(pencil.className).toContain('2xl:inline-flex');

        fireEvent.click(pencil);

        expect(
            screen
                .getByRole('textbox', { name: 'Board name' })
                .getAttribute('maxlength'),
        ).toBe('60');
    });

    it('shows no pencil without onRename', () => {
        renderWithProviders(<SessionTitle>Sprint 42</SessionTitle>);

        expect(screen.queryByRole('button')).toBeNull();

        fireEvent.keyDown(screen.getByRole('heading', { level: 1 }), {
            key: 'F2',
        });

        expect(screen.queryByRole('textbox')).toBeNull();
    });

    it('has no subtitle unless one is given', () => {
        const { container } = renderWithProviders(
            <SessionTitle>Sprint 42</SessionTitle>,
        );

        expect(
            container.querySelector('[data-slot="session-subtitle"]'),
        ).toBeNull();
    });
});
