<?php

namespace App\Http\Controllers;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Mail\Mailable;

class MailPreviewsController extends Controller
{
    public function show(Request $request, string $mail): Response
    {
        abort_unless(app()->environment(['local', 'testing']), 404);

        $sample = $this->samples()[$mail] ?? null;

        abort_if($sample === null, 404);

        $mailable = $sample();

        abort_if($mailable === null, 404);

        $locale = $request->query('locale');

        if (in_array($locale, config('skrum.locales'), true)) {
            $mailable->locale($locale);
        }

        return response($mailable->render());
    }

    /**
     * @return array<string, Closure(): ?Mailable>
     */
    private function samples(): array
    {
        return [];
    }
}
