import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
    requestActionItemsSearch,
    useActionItemsSearchRequests,
} from '@/lib/action-items/search';

describe('action items search requests', () => {
    it('hands the term from the topbar to the page', () => {
        const onSearch = vi.fn();
        const { unmount } = renderHook(() =>
            useActionItemsSearchRequests(onSearch),
        );

        requestActionItemsSearch('runbook');
        requestActionItemsSearch(null);

        expect(onSearch.mock.calls).toEqual([['runbook'], [null]]);

        unmount();
        requestActionItemsSearch('later');

        expect(onSearch).toHaveBeenCalledTimes(2);
    });
});
