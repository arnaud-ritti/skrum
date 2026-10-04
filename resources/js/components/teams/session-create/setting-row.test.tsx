import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SettingRow } from '@/components/teams/session-create/setting-row';
import { Switch } from '@/components/ui/switch';
import { renderWithProviders } from '@/test/render';

function row(error?: string) {
    return (
        <SettingRow
            label="Anonymous cards"
            htmlFor="anonymous"
            help="Authors are never shown"
            error={error}
        >
            <Switch id="anonymous" />
        </SettingRow>
    );
}

describe('SettingRow', () => {
    it('describes its control by the help, then by the error while there is one', () => {
        const view = renderWithProviders(row());
        const control = () =>
            screen.getByRole('switch', { name: 'Anonymous cards' });

        expect(control().getAttribute('aria-describedby')).toBe(
            'anonymous-help',
        );

        view.rerender(row('This setting is locked.'));

        expect(control().getAttribute('aria-describedby')).toBe(
            'anonymous-help anonymous-error',
        );

        view.rerender(row());

        expect(control().getAttribute('aria-describedby')).toBe(
            'anonymous-help',
        );
    });
});
