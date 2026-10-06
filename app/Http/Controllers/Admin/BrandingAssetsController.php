<?php

namespace App\Http\Controllers\Admin;

use App\Exceptions\InvalidBrandAsset;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\BrandingAssetStoreRequest;
use App\Support\Branding\BrandAssets;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Symfony\Component\HttpFoundation\Response;

class BrandingAssetsController extends Controller
{
    public function store(BrandingAssetStoreRequest $request, BrandAssets $assets, string $asset): Response
    {
        try {
            $assets->store($asset, $request->file('file'));
        } catch (InvalidBrandAsset $invalidBrandAsset) {
            throw ValidationException::withMessages(['file' => $invalidBrandAsset->getMessage()]);
        }

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Image saved.')]);

        return $this->brandingPage($request);
    }

    public function destroy(Request $request, BrandAssets $assets, string $asset): Response
    {
        $assets->remove($asset);

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Image removed.')]);

        return $this->brandingPage($request);
    }

    /**
     * The logo and the favicon are printed in the document: the page is loaded in full, by the last write
     * when the form sends several in a row (`followed`).
     */
    private function brandingPage(Request $request): Response
    {
        if ($request->boolean('followed')) {
            return to_route('admin.branding.edit');
        }

        return Inertia::location(route('admin.branding.edit'));
    }
}
