import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useTrans } from '@/hooks/use-trans';

vi.mock('@inertiajs/react', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@inertiajs/react')>()),
    usePage: () => ({
        props: {
            translations: { 'Ask :name for a new one.': 'Demande-le à :name.' },
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
});
