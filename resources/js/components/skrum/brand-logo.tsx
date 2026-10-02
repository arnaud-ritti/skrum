import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import type { BrandIdentity } from '@/types';

const base = 'w-auto max-w-full min-w-0 object-contain object-left';

export function BrandLogo({
    brand,
    className,
    fallback,
}: {
    brand?: BrandIdentity;
    className?: string;
    fallback: ReactNode;
}) {
    if (!brand?.logoLightUrl) {
        return fallback;
    }

    if (!brand.logoDarkUrl) {
        return (
            <img
                src={brand.logoLightUrl}
                alt={brand.name}
                className={cn(
                    base,
                    'dark:rounded-md dark:bg-card dark:p-0.5',
                    className,
                )}
            />
        );
    }

    return (
        <>
            <img
                src={brand.logoLightUrl}
                alt={brand.name}
                className={cn(base, 'dark:hidden', className)}
            />
            <img
                src={brand.logoDarkUrl}
                alt={brand.name}
                className={cn(base, 'hidden dark:block', className)}
            />
        </>
    );
}
