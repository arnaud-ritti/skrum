import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SuggestionsList } from '@/components/retro/suggestions-list';
import { boardContext, renderInBoard, retroSnapshot } from '@/test/retro-board';

vi.mock('@inertiajs/react', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@inertiajs/react')>()),
    usePage: () => ({ props: { translations: {}, locale: 'en' } }),
}));

describe('SuggestionsList', () => {
    it('says in words that a suggestion went to the action items, not by its icon alone', () => {
        renderInBoard(
            <SuggestionsList />,
            boardContext(
                retroSnapshot({
                    insights: {
                        themes: [],
                        suggestedActions: [
                            {
                                id: 's1',
                                content: 'Pair on the flaky tests',
                                themeId: null,
                                status: 'promoted',
                                actionItemId: 'item-1',
                            },
                        ],
                    },
                }),
            ),
        );

        expect(
            screen.getByRole('link', {
                name: /^Pair on the flaky tests\s*· Added to action items$/,
            }),
        ).toBeTruthy();
    });
});
