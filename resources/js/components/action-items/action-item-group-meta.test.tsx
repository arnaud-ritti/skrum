import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ActionItemGroupMeta } from '@/components/action-items/action-item-group-meta';
import { actionItemFixture } from '@/test/action-items';
import { renderWithProviders } from '@/test/render';

const countLabel = (count: number) => `${count} items`;
const sprint = {
    id: 's42',
    number: 42,
    startsOn: '2026-09-21',
    endsOn: '2026-10-04',
    teamId: 't1',
    itemIds: [],
};

describe('ActionItemGroupMeta', () => {
    it('reads a current sprint as in progress, with its count and days', () => {
        renderWithProviders(
            <ActionItemGroupMeta
                countLabel={countLabel}
                group={{
                    key: 'sprint-s42',
                    label: 'Sprint 42',
                    sprint: { ...sprint, state: 'current' },
                    items: [
                        actionItemFixture({ id: 'a' }),
                        actionItemFixture({ id: 'b' }),
                    ],
                }}
            />,
        );

        expect(screen.getByText('In progress')).toBeTruthy();
        expect(screen.getByText(/^2 action items · /)).toBeTruthy();
    });

    it('reads a finished sprint with what was carried over and what is overdue', () => {
        renderWithProviders(
            <ActionItemGroupMeta
                countLabel={countLabel}
                group={{
                    key: 'sprint-s41',
                    label: 'Sprint 41',
                    sprint: {
                        ...sprint,
                        id: 's41',
                        number: 41,
                        state: 'finished',
                    },
                    items: [
                        actionItemFixture({
                            id: 'a',
                            status: 'open',
                            isOverdue: true,
                        }),
                        actionItemFixture({
                            id: 'b',
                            status: 'doing',
                            isOverdue: false,
                        }),
                        actionItemFixture({
                            id: 'c',
                            status: 'completed',
                            isOverdue: false,
                        }),
                    ],
                }}
            />,
        );

        expect(screen.getByText('Finished')).toBeTruthy();
        expect(screen.getByText('2 carried over')).toBeTruthy();
        expect(screen.getByText('1 overdue')).toBeTruthy();
    });

    it('counts the rows of any other group as today', () => {
        renderWithProviders(
            <ActionItemGroupMeta
                countLabel={countLabel}
                group={{
                    key: 'no-sprint',
                    label: 'No sprint',
                    sprint: null,
                    items: [actionItemFixture({ id: 'a' })],
                }}
            />,
        );

        expect(screen.getByText('1 items')).toBeTruthy();
        expect(screen.queryByText('In progress')).toBeNull();
    });
});
