import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useTrans } from '@/hooks/use-trans';

const page = vi.hoisted(() => ({ locale: 'fr' }));

vi.mock('@inertiajs/react', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@inertiajs/react')>()),
    usePage: () => ({
        props: {
            locale: page.locale,
            translations: {
                'Ask :name for a new one.': 'Demande-le à :name.',
                ":name's turn": 'Tour de :name',
            },
        },
    }),
}));

describe('useTrans', () => {
    it('puts the replacement in the line', () => {
        const { result } = renderHook(() => useTrans());

        expect(
            result.current.t('Ask :name for a new one.', { name: 'Ada' }),
        ).toBe('Demande-le à Ada.');
    });

    it('keeps the dollar patterns of a replacement as they are written', () => {
        const { result } = renderHook(() => useTrans());

        expect(
            result.current.t('Ask :name for a new one.', { name: "$$5 $& $'" }),
        ).toBe("Demande-le à $$5 $& $'.");
    });

    it('elides the French word before a name that starts with a vowel', () => {
        page.locale = 'fr';
        const { result } = renderHook(() => useTrans());

        expect(result.current.t(":name's turn", { name: 'Arnaud Ritti' })).toBe(
            "Tour d'Arnaud Ritti",
        );
        expect(result.current.t(":name's turn", { name: 'Marc' })).toBe(
            'Tour de Marc',
        );
    });

    it('does not elide outside French', () => {
        page.locale = 'en';
        const { result } = renderHook(() => useTrans());

        expect(result.current.t(":name's turn", { name: 'Arnaud' })).toBe(
            'Tour de Arnaud',
        );
    });
});
