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
 * An Inertia visit as a promise: resolved by the redirect or by the full page
 * load the server answers a brand write with, rejected by validation errors
 * or by a visit that ended without a response.
 */
function visit(
    route: { url: string; method: 'post' | 'delete' },
    data?: Record<string, File>,
): Promise<void> {
    return new Promise((resolve, reject) => {
        const stopListening = router.on('location', () => resolve());

        router.visit(route.url, {
            method: route.method,
            data,
            forceFormData: data !== undefined,
            preserveScroll: true,
            preserveState: true,
            onSuccess: () => resolve(),
            onError: (errors) => reject(new BrandingVisitError(errors)),
            onFinish: () => {
                stopListening();
                reject(new BrandingVisitError());
            },
        });
    });
}

/** `followed`: another write of the same save comes next, and brings the full page load. */
function followedBy(followed: boolean): { query?: { followed: 1 } } {
    return followed ? { query: { followed: 1 } } : {};
}

export function fetchPalettePreview(color: string): Promise<Palette> {
    return retroRequest<Palette>(
        BrandingPreviewsController.show({ query: { color } }),
    );
}

export function uploadAsset(
    asset: BrandAssetName,
    file: File,
    followed: boolean,
): Promise<void> {
    return visit(BrandingAssetsController.store(asset, followedBy(followed)), {
        file,
    });
}

export function removeAsset(
    asset: BrandAssetName,
    followed: boolean,
): Promise<void> {
    return visit(BrandingAssetsController.destroy(asset, followedBy(followed)));
}

export function resetBranding(): Promise<void> {
    return visit(BrandingController.destroy());
}
