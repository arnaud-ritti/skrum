<?php

namespace App\Http\Controllers\Retros;

use App\Actions\Retros\RetroGuard;
use App\Events\Retros\CardGroupNamed;
use App\Http\Controllers\Controller;
use App\Models\Card;
use App\Models\Participant;
use App\Models\Retro;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class CardGroupNamesController extends Controller
{
    public function update(Request $request, Retro $retro, Card $card): JsonResponse
    {
        Participant::current($request);

        $this->guard($retro);

        $validated = $request->validate([
            'name' => ['present', 'nullable', 'string', 'max:60'],
        ]);

        return $this->rename($retro, $card, $validated['name']);
    }

    public function destroy(Request $request, Retro $retro, Card $card): JsonResponse
    {
        Participant::current($request);

        $this->guard($retro);

        return $this->rename($retro, $card, null);
    }

    private function rename(Retro $retro, Card $card, ?string $name): JsonResponse
    {
        DB::transaction(function () use ($retro, $card, $name): void {
            $locked = Retro::query()->whereKey($retro->id)->lockForUpdate()->firstOrFail();

            $this->guard($locked);

            $lead = $locked->cards()->whereKey($card->id)->firstOrFail();

            if (! $lead->isTopLevel() || $lead->children()->doesntExist()) {
                throw ValidationException::withMessages(['card' => __('Only groups can be named.')]);
            }

            $lead->update(['group_name' => $name]);

            (new CardGroupNamed($locked->id, $lead->id, $name))->sendToOthers();
        });

        return response()->json(['cardId' => $card->id, 'groupName' => $name]);
    }

    private function guard(Retro $retro): void
    {
        RetroGuard::groupNaming($retro);
    }
}
