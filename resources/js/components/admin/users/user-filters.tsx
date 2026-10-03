import { router } from '@inertiajs/react';
import { Search } from 'lucide-react';
import { useEffect, useId, useState } from 'react';
import type { ReactElement } from 'react';
import UsersController from '@/actions/App/Http/Controllers/Admin/UsersController';
import { Input } from '@/components/ui/input';
import { ToggleGroup } from '@/components/ui/toggle-group';
import { useTrans } from '@/hooks/use-trans';
import type { AdminUsersFilters, AdminUsersStatus } from '@/lib/admin/types';

export const SearchDelay = 300;

/** The listing's address: the defaults (no term, every account, page one) stay out of it. */
export function usersUrl(filters: AdminUsersFilters, page = 1): string {
    const query: Record<string, string | number> = {};
    const term = filters.query?.trim() ?? '';

    if (term !== '') {
        query.query = term;
    }

    if (filters.status !== 'all') {
        query.status = filters.status;
    }

    if (page > 1) {
        query.page = page;
    }

    return UsersController.index.url({ query });
}

function visit(filters: AdminUsersFilters): void {
    router.get(
        usersUrl(filters),
        {},
        { preserveState: true, preserveScroll: true, replace: true },
    );
}

export function UserFilters({
    filters,
}: {
    filters: AdminUsersFilters;
}): ReactElement {
    const { t } = useTrans();
    const searchId = useId();
    const [term, setTerm] = useState(filters.query ?? '');
    const { query, status } = filters;

    useEffect(() => {
        if (term.trim() === (query ?? '')) {
            return;
        }

        const timer = window.setTimeout(
            () => visit({ query: term, status }),
            SearchDelay,
        );

        return () => window.clearTimeout(timer);
    }, [term, query, status]);

    return (
        <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-2">
            <div className="relative min-w-0 flex-1 basis-56">
                <label htmlFor={searchId} className="sr-only">
                    {t('Search by name or email address')}
                </label>
                <Search
                    aria-hidden="true"
                    className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
                />
                <Input
                    id={searchId}
                    type="search"
                    value={term}
                    maxLength={100}
                    placeholder={t('Search by name or email address')}
                    className="pl-9"
                    onChange={(event) => setTerm(event.target.value)}
                />
            </div>
            <ToggleGroup
                type="single"
                variant="segmented"
                aria-label={t('Filter accounts')}
                value={filters.status}
                onValueChange={(status: AdminUsersStatus) =>
                    visit({ query: term, status })
                }
                options={[
                    { value: 'all', label: t('All') },
                    { value: 'active', label: t('Active') },
                    { value: 'deactivated', label: t('Deactivated') },
                    { value: 'admins', label: t('Admins') },
                ]}
            />
        </div>
    );
}
