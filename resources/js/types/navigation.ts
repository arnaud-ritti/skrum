import type { InertiaLinkProps } from '@inertiajs/react';

export type BreadcrumbItem = {
    /** Shown as given: the page translates its own words, never the names. */
    title: string;
    href: NonNullable<InertiaLinkProps['href']>;
};
