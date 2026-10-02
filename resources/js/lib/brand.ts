import type { Brand, BrandIdentity } from '@/types';

const ProductName = 'Skrüm';

function withoutAccents(name: string): string {
    return name
        .normalize('NFD')
        .replace(/\p{Diacritic}/gu, '')
        .trim()
        .toLowerCase();
}

/**
 * The instance runs under its own logo or its own name. "Skrum", the default
 * application name of an installation, is still the product.
 */
export function isRebranded(brand: BrandIdentity | undefined): boolean {
    if (!brand) {
        return false;
    }

    return (
        brand.logoLightUrl !== null ||
        withoutAccents(brand.name) !== withoutAccents(ProductName)
    );
}

export function showsPoweredBy(brand: Brand | undefined): boolean {
    return brand?.poweredBy === true && isRebranded(brand);
}
