import { usePage } from '@inertiajs/react';
import { AuthAside } from '@/components/auth/auth-aside';
import { BrandLogo } from '@/components/skrum/brand-logo';
import { isRebranded } from '@/lib/brand';

/**
 * Right pane of the split auth screen: the Skrüm promise on a Skrüm instance,
 * the brand alone on a rebranded one (owner's answer 11-D4).
 */
export function BrandAside() {
    const { brand } = usePage().props;

    if (!isRebranded(brand)) {
        return <AuthAside />;
    }

    return (
        <div
            data-slot="brand-aside"
            className="flex max-w-full min-w-0 items-center justify-center"
        >
            <BrandLogo
                brand={brand}
                className="h-24 object-center"
                fallback={
                    <p className="max-w-full font-display text-display-xl break-words text-foreground">
                        {brand.name}
                    </p>
                }
            />
        </div>
    );
}
