import { act, render } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { TeamPageProps } from '@/components/teams/team-page';
import ShowTeam from '@/pages/teams/show';

vi.mock('@inertiajs/react', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@inertiajs/react')>()),
    usePage: () => ({ props: { translations: {} } }),
    Head: () => null,
}));

vi.mock('@/layouts/skrum/app-layout', () => ({
    default: ({
        active,
        children,
    }: {
        active?: string;
        children: ReactNode;
    }) => <main data-active={active}>{children}</main>,
}));

vi.mock('@/components/teams/team-page', () => ({ TeamPage: () => null }));

const props = {
    workspace: { id: 'w1', name: 'Nordlys', slug: 'nordlys' },
    team: { id: 't1', name: 'Atlas' },
} as TeamPageProps;

function markedEntry(): string | null | undefined {
    return document.querySelector('main')?.getAttribute('data-active');
}

afterEach(() => {
    window.location.hash = '';
});

describe('ShowTeam', () => {
    it.each(['', '#sessions', '#mood', '#members', '#settings'])(
        'marks Home whatever the hash (%s): the mood, the members and the settings are pages of their own',
        (hash) => {
            window.location.hash = hash;

            render(<ShowTeam {...props} />);

            expect(markedEntry()).toBe('dashboard');
        },
    );

    it('keeps Home marked when the hash changes', () => {
        render(<ShowTeam {...props} />);

        act(() => {
            window.location.hash = '#members';
            window.dispatchEvent(new HashChangeEvent('hashchange'));
        });

        expect(markedEntry()).toBe('dashboard');
    });
});
