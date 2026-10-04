import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useTrans } from '@/hooks/use-trans';

vi.mock('@inertiajs/react', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@inertiajs/react')>()),
    usePage: () => ({
        props: { translations: { 'Hello :name': 'Bonjour :name' } },
    }),
}));

describe('useTrans', () => {
    it('puts the replacement in the line', () => {
        const { result } = renderHook(() => useTrans());

        expect(result.current.t('Hello :name', { name: 'Ada' })).toBe(
            'Bonjour Ada',
        );
    });

    it('keeps the dollar patterns of a replacement as they are written', () => {
        const { result } = renderHook(() => useTrans());

        expect(result.current.t('Hello :name', { name: "$$5 $& $'" })).toBe(
            "Bonjour $$5 $& $'",
        );
    });
});
