import type { Brand } from '@/types';

const ProductName = 'Skrüm';

export function showsPoweredBy(brand: Brand | undefined): boolean {
    if (!brand?.poweredBy) {
        return false;
    }

    return brand.logoLightUrl !== null || brand.name !== ProductName;
}
