import { act, screen, within } from '@testing-library/react';
import type { DndContextProps, DragEndEvent } from '@dnd-kit/core';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { HealthStatementsManagerProps } from '@/components/skrum/health-check-manager';
import { TeamHealthManager } from '@/components/teams/team-health-manager';
import { renderWithProviders } from '@/test/render';
import type { TeamHealthStatement } from '@/types';

const mocks = vi.hoisted(() => ({
    post: vi.fn(),
    patch: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    manager: null as unknown,
    dnd: null as unknown,
    props: { translations: {}, locale: 'en' },
}));

vi.mock('@inertiajs/react', async (importOriginal) => {
    const original = await importOriginal<typeof import('@inertiajs/react')>();

    return {
        ...original,
        usePage: () => ({ props: mocks.props }),
        router: {
            post: mocks.post,
            patch: mocks.patch,
            put: mocks.put,
            delete: mocks.delete,
        },
    };
});

vi.mock('@/components/skrum/health-check-manager', async (importOriginal) => {
    const original =
        await importOriginal<
            typeof import('@/components/skrum/health-check-manager')
        >();

    return {
        ...original,
        HealthStatementsManager: (props: HealthStatementsManagerProps) => {
            mocks.manager = props;

            return <original.HealthStatementsManager {...props} />;
        },
    };
});

vi.mock('@dnd-kit/core', async (importOriginal) => {
    const original = await importOriginal<typeof import('@dnd-kit/core')>();

    return {
        ...original,
        DndContext: (props: DndContextProps) => {
            mocks.dnd = props;

            return <original.DndContext {...props} />;
        },
    };
});

type VisitOptions = {
    preserveScroll?: boolean;
    onSuccess?: () => void;
    onError?: (errors: Record<string, string>) => void;
    onFinish?: () => void;
};

const base = '/w/nordlys/teams/team-1/health-statements';

const statements: TeamHealthStatement[] = [
    {
        id: 'interaction',
        key: 'interaction',
        label: 'Interaction',
        text: 'Interaction with colleagues was productive',
        isBuiltin: true,
        isArchived: false,
    },
    {
        id: 'custom-1',
        key: 'custom-1',
        label: 'Delivery',
        text: 'We shipped what we promised',
        isBuiltin: false,
        isArchived: false,
    },
    {
        id: 'vision',
        key: 'vision',
        label: 'Vision',
        text: 'The vision and goals are clear to me',
        isBuiltin: true,
        isArchived: true,
    },
];

const secondCustom: TeamHealthStatement = {
    id: 'custom-2',
    key: 'custom-2',
    label: 'Focus',
    text: 'We were not interrupted',
    isBuiltin: false,
    isArchived: false,
};

function card(canManage = true, list = statements) {
    return renderWithProviders(
        <TeamHealthManager
            workspaceSlug="nordlys"
            teamId="team-1"
            statements={list}
            canManage={canManage}
        />,
    );
}

function activeLabels(): (string | null)[] {
    return Array.from(
        document.querySelectorAll(
            '[data-slot="health-statements-active"] [data-slot="health-statement-label"]',
        ),
    ).map((label) => label.textContent);
}

async function drop(activeId: string, overId: string): Promise<void> {
    await act(async () => {
        (mocks.dnd as DndContextProps).onDragEnd?.({
            active: { id: activeId },
            over: { id: overId },
        } as unknown as DragEndEvent);
    });
}

function managerProps(): HealthStatementsManagerProps {
    return mocks.manager as HealthStatementsManagerProps;
}

function row(text: string): HTMLElement {
    return screen.getByText(text).closest('li') as HTMLElement;
}

async function fillAddForm(): Promise<void> {
    await userEvent.type(
        screen.getByRole('textbox', { name: 'Statement' }),
        'Our meetings were useful',
    );
    await userEvent.type(
        screen.getByRole('textbox', { name: 'Axis label' }),
        'Meetings',
    );
    await userEvent.click(
        screen.getByRole('button', { name: 'Add statement' }),
    );
}

beforeEach(() => {
    mocks.post.mockReset();
    mocks.patch.mockReset();
    mocks.put.mockReset();
    mocks.delete.mockReset();
});

describe('the health check manager of a team', () => {
    it('is a region named by its heading and lists the statements', () => {
        card();

        const region = screen.getByRole('region', {
            name: 'Health check statements',
        });

        expect(
            within(region).getByRole('heading', {
                level: 2,
                name: 'Health check statements',
            }),
        ).toBeTruthy();
        expect(
            within(region).getByText(
                'Changes apply to retros that have not collected answers yet.',
            ),
        ).toBeTruthy();
        expect(
            within(region).getByText(
                'Interaction with colleagues was productive',
            ),
        ).toBeTruthy();
    });

    it('has no control for a member who cannot manage the statements', async () => {
        card(false);

        expect(screen.queryByRole('button', { name: 'Drag to reorder' })).toBe(
            null,
        );
        expect(screen.queryByRole('textbox', { name: 'Statement' })).toBeNull();
        expect(screen.queryByRole('button', { name: 'Archive' })).toBeNull();
        expect(screen.queryByRole('button', { name: 'Edit' })).toBeNull();

        await userEvent.click(
            screen.getByRole('button', { name: 'Archived (1)' }),
        );

        expect(screen.queryByRole('button', { name: 'Restore' })).toBeNull();
    });

    it('adds a statement and empties the form once the server took it', async () => {
        mocks.post.mockImplementation(
            (_url: string, _data: unknown, options: VisitOptions) =>
                options.onSuccess?.(),
        );
        card();

        await fillAddForm();

        expect(mocks.post).toHaveBeenCalledWith(
            base,
            { text: 'Our meetings were useful', label: 'Meetings' },
            expect.objectContaining({ preserveScroll: true }),
        );
        expect(
            (
                screen.getByRole('textbox', {
                    name: 'Statement',
                }) as HTMLInputElement
            ).value,
        ).toBe('');
    });

    it('keeps the draft and shows the server error when a statement is refused', async () => {
        mocks.post.mockImplementation(
            (_url: string, _data: unknown, options: VisitOptions) =>
                options.onError?.({ text: 'Too many statements.' }),
        );
        card();

        await fillAddForm();

        const field = screen.getByRole('textbox', {
            name: 'Statement',
        }) as HTMLInputElement;

        expect(field.value).toBe('Our meetings were useful');
        expect(screen.getByRole('alert').textContent).toContain(
            'Too many statements.',
        );
        expect(field.getAttribute('aria-invalid')).toBe('true');

        mocks.post.mockImplementation(
            (_url: string, _data: unknown, options: VisitOptions) =>
                options.onSuccess?.(),
        );
        await userEvent.click(
            screen.getByRole('button', { name: 'Add statement' }),
        );

        expect(screen.queryByRole('alert')).toBeNull();
    });

    it('rewords a custom statement and closes the editor', async () => {
        mocks.patch.mockImplementation(
            (_url: string, _data: unknown, options: VisitOptions) =>
                options.onSuccess?.(),
        );
        card();

        const custom = row('We shipped what we promised');

        await userEvent.click(
            within(custom).getByRole('button', { name: 'Edit' }),
        );

        const field = within(custom).getByRole('textbox', {
            name: 'Statement',
        });

        await userEvent.clear(field);
        await userEvent.type(field, 'We delivered what we promised');
        await userEvent.click(
            within(custom).getByRole('button', { name: 'Save' }),
        );

        expect(mocks.patch).toHaveBeenCalledWith(
            `${base}/custom-1`,
            { text: 'We delivered what we promised', label: 'Delivery' },
            expect.objectContaining({ preserveScroll: true }),
        );
        expect(
            within(custom).queryByRole('textbox', { name: 'Statement' }),
        ).toBeNull();
    });

    it('keeps the editor open with the server error when the rewording is refused', async () => {
        mocks.patch.mockImplementation(
            (_url: string, _data: unknown, options: VisitOptions) =>
                options.onError?.({ label: 'The label is too long.' }),
        );
        card();

        const custom = row('We shipped what we promised');

        await userEvent.click(
            within(custom).getByRole('button', { name: 'Edit' }),
        );
        await userEvent.click(
            within(custom).getByRole('button', { name: 'Save' }),
        );

        expect(
            within(custom).getByRole('textbox', { name: 'Statement' }),
        ).toBeTruthy();
        expect(within(custom).getByRole('alert').textContent).toContain(
            'The label is too long.',
        );
    });

    it('archives and restores a statement', async () => {
        card();

        await userEvent.click(
            within(row('Interaction with colleagues was productive')).getByRole(
                'button',
                { name: 'Archive' },
            ),
        );

        expect(mocks.put).toHaveBeenCalledWith(
            `${base}/interaction/archival`,
            {},
            expect.objectContaining({ preserveScroll: true }),
        );

        await userEvent.click(
            screen.getByRole('button', { name: 'Archived (1)' }),
        );
        await userEvent.click(screen.getByRole('button', { name: 'Restore' }));

        expect(mocks.delete).toHaveBeenCalledWith(
            `${base}/vision/archival`,
            expect.objectContaining({ preserveScroll: true }),
        );
    });

    it('shows on the list the error of a refused archival, and clears it on the next success', async () => {
        mocks.put.mockImplementation(
            (_url: string, _data: unknown, options: VisitOptions) =>
                options.onError?.({
                    statements:
                        'A team needs between 3 and 10 health check statements.',
                }),
        );
        card();

        const archive = within(
            row('Interaction with colleagues was productive'),
        ).getByRole('button', { name: 'Archive' });

        await userEvent.click(archive);

        expect(screen.getByRole('alert').textContent).toContain(
            'A team needs between 3 and 10 health check statements.',
        );

        mocks.put.mockImplementation(
            (_url: string, _data: unknown, options: VisitOptions) =>
                options.onSuccess?.(),
        );
        await userEvent.click(archive);

        expect(screen.queryByRole('alert')).toBeNull();
    });

    it('sends the new order of the active statements', async () => {
        mocks.put.mockImplementation(
            (_url: string, _data: unknown, options: VisitOptions) =>
                options.onError?.({
                    ids: 'Send every active health check statement exactly once.',
                }),
        );
        card();

        await act(async () => {
            await managerProps().onReorder(['custom-1', 'interaction']);
        });

        expect(mocks.put).toHaveBeenCalledWith(
            '/w/nordlys/teams/team-1/health-statement-order',
            { ids: ['custom-1', 'interaction'] },
            expect.objectContaining({ preserveScroll: true }),
        );
        expect(screen.getByRole('alert').textContent).toContain(
            'Send every active health check statement exactly once.',
        );
    });

    it('frees the add form and says so when the request ends without an answer', async () => {
        mocks.post.mockImplementation(
            (_url: string, _data: unknown, options: VisitOptions) =>
                options.onFinish?.(),
        );
        card();

        await fillAddForm();

        expect(
            (
                screen.getByRole('button', {
                    name: 'Add statement',
                }) as HTMLButtonElement
            ).disabled,
        ).toBe(false);
        expect(
            (
                screen.getByRole('textbox', {
                    name: 'Statement',
                }) as HTMLInputElement
            ).value,
        ).toBe('Our meetings were useful');
        expect(screen.getByRole('alert').textContent).toContain(
            'Something went wrong. Please try again.',
        );
    });

    it('frees the editor of a row when the request ends without an answer', async () => {
        mocks.patch.mockImplementation(
            (_url: string, _data: unknown, options: VisitOptions) =>
                options.onFinish?.(),
        );
        card();

        const custom = row('We shipped what we promised');

        await userEvent.click(
            within(custom).getByRole('button', { name: 'Edit' }),
        );
        await userEvent.click(
            within(custom).getByRole('button', { name: 'Save' }),
        );

        expect(
            (
                within(custom).getByRole('button', {
                    name: 'Save',
                }) as HTMLButtonElement
            ).disabled,
        ).toBe(false);
    });

    it('does not show the refused rewording of one statement in the editor of another', async () => {
        mocks.patch.mockImplementation(
            (_url: string, _data: unknown, options: VisitOptions) =>
                options.onError?.({ text: 'The text has already been taken.' }),
        );
        card(true, [...statements, secondCustom]);

        const first = row('We shipped what we promised');

        await userEvent.click(
            within(first).getByRole('button', { name: 'Edit' }),
        );
        await userEvent.click(
            within(first).getByRole('button', { name: 'Save' }),
        );

        expect(within(first).getByRole('alert')).toBeTruthy();

        await userEvent.click(
            within(first).getByRole('button', { name: 'Cancel' }),
        );

        const second = row('We were not interrupted');

        await userEvent.click(
            within(second).getByRole('button', { name: 'Edit' }),
        );

        expect(screen.queryByRole('alert')).toBeNull();
        expect(
            within(second)
                .getByRole('textbox', { name: 'Statement' })
                .getAttribute('aria-invalid'),
        ).toBeNull();

        await userEvent.click(
            within(second).getByRole('button', { name: 'Cancel' }),
        );
        await userEvent.click(
            within(first).getByRole('button', { name: 'Edit' }),
        );

        expect(screen.queryByRole('alert')).toBeNull();

        await userEvent.click(
            within(first).getByRole('button', { name: 'Save' }),
        );

        expect(within(first).getByRole('alert').textContent).toContain(
            'The text has already been taken.',
        );
    });

    it('keeps the dropped order while the server takes it', async () => {
        card();

        await drop('custom-1', 'interaction');

        expect(activeLabels()).toEqual(['Delivery', 'Interaction']);
    });

    it('puts the list back in the saved order and says so when the reorder ends without an answer', async () => {
        mocks.put.mockImplementation(
            (_url: string, _data: unknown, options: VisitOptions) =>
                options.onFinish?.(),
        );
        card();

        await drop('custom-1', 'interaction');

        expect(activeLabels()).toEqual(['Interaction', 'Delivery']);
        expect(screen.getByRole('alert').textContent).toContain(
            'Something went wrong. Please try again.',
        );
    });
});
