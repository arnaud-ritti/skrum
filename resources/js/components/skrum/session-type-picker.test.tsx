import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SessionTypePicker } from '@/components/skrum/session-type-picker';
import type { SessionTypeOption } from '@/components/skrum/session-type-picker';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const options: SessionTypeOption[] = [
    { value: 'retro', label: 'Retro', description: 'd', duration: '45 min' },
    {
        value: 'poker',
        label: 'Poker',
        description: 'd',
        duration: '30 min',
        disabledReason: 'Disabled by the admin',
    },
    { value: 'survey', label: 'Survey', description: 'd', duration: '5 min' },
];

describe('SessionTypePicker', () => {
    it('renders the five types in order by default', () => {
        render(<SessionTypePicker value="retro" onValueChange={vi.fn()} />);

        expect(
            screen.getAllByRole('radio').map((radio) => radio.dataset.type),
        ).toEqual(['retro', 'poker', 'whiteboard', 'survey', 'icebreaker']);
    });

    it('names the survey type Poll, a quick vote or a health check', () => {
        render(<SessionTypePicker value="retro" onValueChange={vi.fn()} />);

        const poll = screen.getByRole('radio', { name: /Poll/ });

        expect(poll.dataset.type).toBe('survey');
        expect(poll.textContent).toContain('Quick vote or health check');
        expect(poll.textContent).toContain('5–10 min');
    });

    it('marks the selection checked and makes only it tabbable', () => {
        render(
            <SessionTypePicker
                value="survey"
                onValueChange={vi.fn()}
                options={options}
                label="Session type"
            />,
        );

        const survey = screen.getByRole('radio', { name: /Survey/ });

        expect(survey.getAttribute('aria-checked')).toBe('true');
        expect(survey.tabIndex).toBe(0);
        expect(screen.getByRole('radio', { name: /Retro/ }).tabIndex).toBe(-1);
        expect(
            screen.getByRole('radiogroup', { name: 'Session type' }),
        ).toBeTruthy();
    });

    it('selects on click', () => {
        const onValueChange = vi.fn();

        render(
            <SessionTypePicker
                value="retro"
                onValueChange={onValueChange}
                options={options}
            />,
        );
        fireEvent.click(screen.getByRole('radio', { name: /Survey/ }));

        expect(onValueChange).toHaveBeenCalledWith('survey');
    });

    it('skips disabled options with the arrow keys and wraps around', () => {
        const onValueChange = vi.fn();

        render(
            <SessionTypePicker
                value="retro"
                onValueChange={onValueChange}
                options={options}
            />,
        );
        const retro = screen.getByRole('radio', { name: /Retro/ });

        fireEvent.keyDown(retro, { key: 'ArrowRight' });
        expect(onValueChange).toHaveBeenLastCalledWith('survey');

        fireEvent.keyDown(retro, { key: 'ArrowLeft' });
        expect(onValueChange).toHaveBeenLastCalledWith('survey');
    });

    it('shows the reason of a disabled option and never selects it', () => {
        const onValueChange = vi.fn();

        render(
            <SessionTypePicker
                value="retro"
                onValueChange={onValueChange}
                options={options}
            />,
        );
        const poker = screen.getByRole('radio', { name: /Poker/ });

        fireEvent.click(poker);

        expect(onValueChange).not.toHaveBeenCalled();
        expect(poker.getAttribute('aria-disabled')).toBe('true');
        expect(poker.getAttribute('aria-checked')).toBe('false');
        expect(screen.getByText('Disabled by the admin')).toBeTruthy();
    });

    it('renders the compact list with the same radio semantics', () => {
        const onValueChange = vi.fn();

        render(
            <SessionTypePicker
                value="retro"
                onValueChange={onValueChange}
                options={options}
                variant="compact"
            />,
        );
        fireEvent.click(screen.getByRole('radio', { name: /Survey/ }));

        expect(onValueChange).toHaveBeenCalledWith('survey');
        expect(screen.getAllByRole('radio')).toHaveLength(3);
    });

    it('renders the one-line tiles with the description, and the reason of a disabled type', () => {
        const onValueChange = vi.fn();

        render(
            <SessionTypePicker
                variant="inline"
                value="retro"
                onValueChange={onValueChange}
                options={options}
            />,
        );

        const group = screen.getByRole('radiogroup');
        const poker = screen.getByRole('radio', { name: /Poker/ });

        expect(group.dataset.variant).toBe('inline');
        expect(screen.getAllByRole('radio')).toHaveLength(3);
        expect(screen.queryByText('45 min')).toBeNull();
        expect(poker.getAttribute('aria-disabled')).toBe('true');
        expect(poker.textContent).toContain('Disabled by the admin');

        fireEvent.click(poker);
        fireEvent.click(screen.getByRole('radio', { name: /Survey/ }));

        expect(onValueChange.mock.calls).toEqual([['survey']]);
    });

    it('renders menu item radios inside a dropdown menu', () => {
        const onValueChange = vi.fn();

        render(
            <DropdownMenu open>
                <DropdownMenuTrigger>Open</DropdownMenuTrigger>
                <DropdownMenuContent>
                    <SessionTypePicker
                        value="retro"
                        onValueChange={onValueChange}
                        options={options}
                        variant="compact"
                        as="menu"
                    />
                </DropdownMenuContent>
            </DropdownMenu>,
        );
        const items = screen.getAllByRole('menuitemradio');

        expect(items).toHaveLength(3);
        expect(items[0].getAttribute('aria-checked')).toBe('true');
        expect(items[1].getAttribute('aria-disabled')).toBe('true');
        expect(screen.getByText('Disabled by the admin')).toBeTruthy();
    });
});
