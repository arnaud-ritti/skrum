import { act, renderHook } from '@testing-library/react';
import { toast } from 'sonner';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useBulkResultToast } from '@/components/action-items/bulk-result-toast';

vi.mock('sonner', () => ({
    toast: { success: vi.fn(), warning: vi.fn() },
}));

beforeEach(() => {
    vi.mocked(toast.success).mockReset();
});

describe('useBulkResultToast', () => {
    it.each([
        [1, 0, '1 action item exported.'],
        [3, 0, '3 action items exported.'],
        [2, 1, '2 exported, 1 already linked.'],
    ])(
        'reports %i exported and %i already linked',
        (exported, skipped, sentence) => {
            const { result } = renderHook(() => useBulkResultToast());

            act(() => result.current.report('export', exported, [], skipped));

            expect(toast.success).toHaveBeenCalledWith(sentence);
        },
    );
});
