import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { BulkMatchingConfirm } from '@/components/action-items/bulk-matching-confirm';
import { renderWithProviders } from '@/test/render';

describe('BulkMatchingConfirm', () => {
    it.each([
        [1, 'Apply to 1 action item?'],
        [137, 'Apply to 137 action items?'],
    ])('asks to apply to %i matching items', (count, title) => {
        renderWithProviders(
            <BulkMatchingConfirm
                open
                count={count}
                onApply={vi.fn(async () => undefined)}
                onCancel={vi.fn()}
            />,
        );

        expect(screen.getByRole('alertdialog', { name: title })).toBeTruthy();
    });
});
