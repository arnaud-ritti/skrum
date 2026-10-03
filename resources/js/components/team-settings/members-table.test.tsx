import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
    afterEach,
    beforeAll,
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from 'vitest';
import { MembersTable } from '@/components/team-settings/members-table';
import { renderWithProviders } from '@/test/render';
import type { TeamRole, TeamSettingsMember } from '@/types';

type VisitOptions = {
    only?: string[];
    onSuccess?: () => void;
    onError?: (errors: Record<string, string>) => void;
};

const mocks = vi.hoisted(() => ({
    put: vi.fn(),
    delete: vi.fn(),
    wide: true,
    online: new Set<string>() as ReadonlySet<string>,
}));

vi.mock('@inertiajs/react', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@inertiajs/react')>()),
    usePage: () => ({ props: { translations: {}, locale: 'en' } }),
    router: { put: mocks.put, delete: mocks.delete },
}));

vi.mock('@/hooks/use-min-width', () => ({ useMinWidth: () => mocks.wide }));

vi.mock('@/hooks/use-online-user-ids', () => ({
    useOnlineUserIds: () => mocks.online,
}));

const roleOptions = [
    { value: 'owner' as const, label: 'Owner' },
    { value: 'facilitator' as const, label: 'Facilitator' },
    { value: 'member' as const, label: 'Member' },
    { value: 'observer' as const, label: 'Observer' },
];

function member(
    id: string,
    name: string,
    role: TeamRole,
    lastActiveAt: string | null,
    isViewer = false,
): TeamSettingsMember {
    return {
        id,
        name,
        email: `${name.toLowerCase().split(' ')[0]}@example.com`,
        avatarUrl: '',
        role,
        lastActiveAt,
        isViewer,
    };
}

const members = [
    member('u1', 'Arnaud Ritti', 'owner', null, true),
    member('u2', 'Camille Roux', 'facilitator', '2026-09-28T10:00:00+00:00'),
    member('u3', 'Theo Martin', 'member', null),
];

function table(canManageMembers = true) {
    return renderWithProviders(
        <MembersTable
            workspaceSlug="nordlys"
            team={{ id: 't1', name: 'Atlas' }}
            members={members}
            canManageMembers={canManageMembers}
            roleOptions={roleOptions}
        />,
    );
}

function row(id: string): HTMLElement {
    const found = document.querySelector<HTMLElement>(
        `[data-member-id="${id}"]`,
    );

    if (found === null) {
        throw new Error(`No row for ${id}`);
    }

    return found;
}

function lastActivity(id: string): string | null | undefined {
    return row(id).querySelector('[data-test="member-last-activity"]')
        ?.textContent;
}

beforeAll(() => {
    Element.prototype.hasPointerCapture = () => false;
    Element.prototype.setPointerCapture = () => {};
    Element.prototype.releasePointerCapture = () => {};
    Element.prototype.scrollIntoView = () => {};
});

beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-09-30T10:00:00Z'));
    mocks.put.mockReset();
    mocks.delete.mockReset();
    mocks.wide = true;
    mocks.online = new Set();
});

afterEach(() => {
    vi.useRealTimers();
});

describe('MembersTable', () => {
    it('counts the members, marks the viewer and explains the roles', () => {
        table();

        expect(
            document.querySelector('[data-slot="settings-panel-subtitle"]')
                ?.textContent,
        ).toBe('3 members');
        expect(row('u1').textContent).toContain('Arnaud Ritti (you)');
        expect(row('u2').textContent).not.toContain('(you)');
        expect(row('u2').textContent).toContain('camille@example.com');
        expect(
            document.querySelector('[data-slot="settings-panel-footer"]')
                ?.textContent,
        ).toBe(
            'Facilitator: drives phases, timer and reveal, and can take control of any open session. Observer: read-only, does not vote.',
        );
    });

    it('says Online for the viewer and for who is in the channel, the date or Never for the others', () => {
        mocks.online = new Set(['u3']);

        const view = table();

        expect(lastActivity('u1')).toBe('Online');
        expect(lastActivity('u3')).toBe('Online');
        expect(lastActivity('u2')).toBe('2 days ago');

        mocks.online = new Set();
        view.rerender(
            <MembersTable
                workspaceSlug="nordlys"
                team={{ id: 't1', name: 'Atlas' }}
                members={members}
                canManageMembers
                roleOptions={roleOptions}
            />,
        );

        expect(lastActivity('u3')).toBe('Never');
        expect(lastActivity('u1')).toBe('Online');
    });

    it('gives an owner a role select per member, with its native twin', () => {
        table();

        expect(
            screen.getAllByRole('combobox', { name: /^Role of / }),
        ).toHaveLength(3);
        expect(document.querySelector('select[name="role-u2"]')).not.toBeNull();
        expect(
            document.querySelector('table[data-test="team-members"]'),
        ).not.toBeNull();
    });

    it('shows a facilitator the roles as text, without a menu', () => {
        table(false);

        expect(screen.queryByRole('combobox')).toBeNull();
        expect(
            screen.queryByRole('button', { name: 'Member actions' }),
        ).toBeNull();
        expect(row('u2').textContent).toContain('Facilitator');
    });

    it('saves a role at once and shows the refusal under the select', async () => {
        table();

        await userEvent.click(
            screen.getByRole('combobox', { name: 'Role of Theo Martin' }),
        );
        await userEvent.click(screen.getByRole('option', { name: 'Observer' }));

        expect(mocks.put).toHaveBeenCalledTimes(1);
        expect(mocks.put.mock.calls[0][0]).toBe(
            '/w/nordlys/teams/t1/members/u3/role',
        );
        expect(mocks.put.mock.calls[0][1]).toEqual({ role: 'observer' });

        await act(async () => {
            (mocks.put.mock.calls[0][2] as VisitOptions).onError?.({
                role: 'The selected role is invalid.',
            });
        });

        expect(
            row('u3').querySelector('[data-slot="member-role-error"]')
                ?.textContent,
        ).toBe('The selected role is invalid.');
    });

    it('removes a member after the confirmation and reloads the members only', async () => {
        table();

        await userEvent.click(
            within(row('u3')).getByRole('button', { name: 'Member actions' }),
        );
        await userEvent.click(
            screen.getByRole('menuitem', { name: 'Remove from team' }),
        );

        const dialog = screen.getByRole('alertdialog', {
            name: 'Remove Theo Martin from Atlas?',
        });

        await userEvent.click(
            within(dialog).getByRole('button', { name: 'Remove from team' }),
        );

        expect(mocks.delete).toHaveBeenCalledTimes(1);
        expect(mocks.delete.mock.calls[0][0]).toBe(
            '/w/nordlys/teams/t1/members/u3',
        );
        expect((mocks.delete.mock.calls[0][1] as VisitOptions).only).toEqual([
            'members',
            'facilitators',
        ]);
    });

    it('lists the members below 40rem and opens the role in a drawer of radios', async () => {
        mocks.wide = false;

        table();

        expect(
            document.querySelector('ul[data-test="team-members"]'),
        ).not.toBeNull();

        await userEvent.click(
            screen.getByRole('button', { name: 'Role of Camille Roux' }),
        );

        const drawer = screen.getByRole('dialog', {
            name: 'Role of Camille Roux',
        });

        expect(within(drawer).getAllByRole('radio')).toHaveLength(4);

        await userEvent.click(
            within(drawer).getByRole('radio', { name: 'Member' }),
        );

        expect(mocks.put.mock.calls[0][1]).toEqual({ role: 'member' });
    });
});
