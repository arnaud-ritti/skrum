import { usePage } from '@inertiajs/react';
import { AuthAside } from '@/components/auth/auth-aside';
import { BrandLogo } from '@/components/skrum/brand-logo';
import { isRebranded } from '@/lib/brand';

/**
 * Right pane of the split auth screen: the promise and its sample notes on
 * every instance; a rebranded one puts its logo, or its name, above them.
 */
export function BrandAside() {
    const { brand } = usePage().props;

    if (!isRebranded(brand)) {
        return <AuthAside />;
    }

    return (
        <AuthAside
            brand={
                <span
                    data-slot="brand-aside"
                    className="flex max-w-full min-w-0 items-center"
                >
                    <BrandLogo
                        brand={brand}
                        className="h-10 object-left"
                        fallback={
                            <span className="max-w-full font-display text-2xl break-words text-foreground">
                                {brand.name}
                            </span>
                        }
                    />
                </span>
            }
        />
    );
}
