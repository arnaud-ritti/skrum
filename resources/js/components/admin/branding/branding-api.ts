import { router } from '@inertiajs/react';
import BrandingAssetsController from '@/actions/App/Http/Controllers/Admin/BrandingAssetsController';
import BrandingController from '@/actions/App/Http/Controllers/Admin/BrandingController';
import BrandingPreviewsController from '@/actions/App/Http/Controllers/Admin/BrandingPreviewsController';
import { retroRequest } from '@/lib/retro/api';
import type { BrandAssetName, Palette } from './branding';

type VisitErrors = Record<string, string>;

export class BrandingVisitError extends Error {
    constructor(public errors: VisitErrors = {}) {
        super(Object.values(errors)[0] ?? '');
    }
}

/**
 * An Inertia visit as a promise: resolved by the redirect, rejected by
 * validation errors or by a visit that ended without a response.
 */
function visit(
    route: { url: string; method: 'post' | 'delete' },
    data?: Record<string, File>,
): Promise<void> {
    return new Promise((resolve, reject) => {
        router.visit(route.url, {
            method: route.method,
            data,
            forceFormData: data !== undefined,
            preserveScroll: true,
            preserveState: true,
            onSuccess: () => resolve(),
            onError: (errors) => reject(new BrandingVisitError(errors)),
            onFinish: () => reject(new BrandingVisitError()),
        });
    });
}

export function fetchPalettePreview(color: string): Promise<Palette> {
    return retroRequest<Palette>(
        BrandingPreviewsController.show({ query: { color } }),
    );
}

export function uploadAsset(asset: BrandAssetName, file: File): Promise<void> {
    return visit(BrandingAssetsController.store(asset), { file });
}

export function removeAsset(asset: BrandAssetName): Promise<void> {
    return visit(BrandingAssetsController.destroy(asset));
}

export function resetBranding(): Promise<void> {
    return visit(BrandingController.destroy());
}
