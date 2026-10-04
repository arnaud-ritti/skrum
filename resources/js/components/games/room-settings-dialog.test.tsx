import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { RoomProvider, type RoomContextValue } from './room-context';
import { RoomSettingsDialog } from './room-settings-dialog';

vi.mock('@inertiajs/react', async (importOriginal) => {
    const original = await importOriginal<typeof import('@inertiajs/react')>();

    return {
        ...original,
        usePage: () => ({
            props: { locale: 'en', locales: ['en', 'fr'], translations: {} },
        }),
    };
});

describe('RoomSettingsDialog', () => {
    it('keeps Save off for a name made only of spaces', () => {
        const ctx = {
            snapshot: {
                room: {
                    id: 'room',
                    name: 'Friday fun',
                    access: 'team',
                    locale: 'en',
                    reactionsEnabled: true,
                },
            },
            run: vi.fn(),
        } as unknown as RoomContextValue;

        renderWithProviders(
            <RoomProvider value={ctx}>
                <RoomSettingsDialog open onOpenChange={vi.fn()} />
            </RoomProvider>,
        );

        const save = screen.getByRole('button', {
            name: 'Save',
        }) as HTMLButtonElement;

        expect(save.disabled).toBe(false);

        fireEvent.change(screen.getByLabelText('Name'), {
            target: { value: '   ' },
        });

        expect(save.disabled).toBe(true);
    });
});
