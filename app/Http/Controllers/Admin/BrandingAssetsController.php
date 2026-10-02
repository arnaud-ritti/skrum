<?php

namespace App\Http\Controllers\Admin;

use App\Exceptions\InvalidBrandAsset;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\BrandingAssetStoreRequest;
use App\Support\Branding\BrandAssets;
use Illuminate\Http\RedirectResponse;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;

class BrandingAssetsController extends Controller
{
    public function store(BrandingAssetStoreRequest $request, BrandAssets $assets, string $asset): RedirectResponse
    {
        try {
            $assets->store($asset, $request->file('file'));
        } catch (InvalidBrandAsset $invalidBrandAsset) {
            throw ValidationException::withMessages(['file' => $invalidBrandAsset->getMessage()]);
        }

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Image saved.')]);

        return to_route('admin.branding.edit');
    }

    public function destroy(BrandAssets $assets, string $asset): RedirectResponse
    {
        $assets->remove($asset);

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Image removed.')]);

        return to_route('admin.branding.edit');
    }
}
