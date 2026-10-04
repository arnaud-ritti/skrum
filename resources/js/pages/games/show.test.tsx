import { describe, expect, it, vi } from 'vitest';
import type { GameSnapshot } from '@/lib/games/types';
import { renderWithProviders } from '@/test/render';
import ShowGameRoom from './show';

const headTitles = vi.hoisted(() => [] as string[]);

vi.mock('@inertiajs/react', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@inertiajs/react')>()),
    usePage: () => ({
        props: { translations: {}, locale: 'en', locales: ['en'], errors: {} },
    }),
    Head: ({ title }: { title: string }) => {
        headTitles.push(title);

        return null;
    },
}));

vi.mock('@/components/games/game-room', () => ({ GameRoom: () => null }));

function snapshotNamed(name: string | null): GameSnapshot {
    return { room: { name } } as unknown as GameSnapshot;
}

describe('games/show page', () => {
    it('names the document after the room, or "Game" when the room has no name', () => {
        const { unmount } = renderWithProviders(
            <ShowGameRoom snapshot={snapshotNamed('Friday fun')} />,
        );

        expect(headTitles).toContain('Friday fun');

        unmount();
        headTitles.length = 0;
        renderWithProviders(<ShowGameRoom snapshot={snapshotNamed(null)} />);

        expect(headTitles).toContain('Game');
    });
});
