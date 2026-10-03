import { fireEvent, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PhaseTimersField } from '@/components/teams/session-create/phase-timers-field';
import { StandardDurations } from '@/lib/retro/phase-durations';
import { renderWithProviders } from '@/test/render';

describe('PhaseTimersField', () => {
    it('has one stepper per timed phase, in phase order', () => {
        renderWithProviders(
            <PhaseTimersField value={StandardDurations} onChange={vi.fn()} />,
        );

        expect(screen.getAllByRole('group').map((group) => group.id)).toEqual([
            'new-retro-phase-writing',
            'new-retro-phase-grouping',
            'new-retro-phase-voting',
            'new-retro-phase-discussing',
            'new-retro-phase-actions',
        ]);
        expect(
            within(screen.getByRole('group', { name: 'Writing' })).getByText(
                '7',
            ),
        ).toBeTruthy();
    });

    it('changes one phase by a minute and reads 0 as off', () => {
        const onChange = vi.fn();

        renderWithProviders(
            <PhaseTimersField
                value={{ ...StandardDurations, voting: 0 }}
                onChange={onChange}
            />,
        );

        expect(
            within(screen.getByRole('group', { name: 'Voting' })).getByText(
                'Off',
            ),
        ).toBeTruthy();
        expect(
            (
                screen.getByRole('button', {
                    name: 'Decrease Voting',
                }) as HTMLButtonElement
            ).disabled,
        ).toBe(true);

        fireEvent.click(
            screen.getByRole('button', { name: 'Increase Writing' }),
        );

        expect(onChange).toHaveBeenCalledWith({
            ...StandardDurations,
            voting: 0,
            writing: 8,
        });
    });

    it('stops at 60 minutes', () => {
        renderWithProviders(
            <PhaseTimersField
                value={{ ...StandardDurations, actions: 60 }}
                onChange={vi.fn()}
            />,
        );

        expect(
            (
                screen.getByRole('button', {
                    name: 'Increase Actions',
                }) as HTMLButtonElement
            ).disabled,
        ).toBe(true);
    });
});
