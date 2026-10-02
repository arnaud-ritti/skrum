<?php

namespace App\Http\Controllers;

use App\Actions\Notifications\BellNotifications;
use App\Actions\Notifications\ListNotifications;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class NotificationsController extends Controller
{
    public function index(Request $request, ListNotifications $listNotifications): JsonResponse
    {
        $validated = $request->validate(['before' => ['sometimes', 'uuid']]);

        return response()->json($listNotifications->handle($request->user(), $validated['before'] ?? null));
    }

    public function update(Request $request, BellNotifications $bellNotifications, string $notification): JsonResponse
    {
        $request->validate(['read' => ['required', 'accepted']]);

        $user = $request->user();

        $user->notifications()->findOrFail($notification)->markAsRead();

        return response()->json(['unreadCount' => $bellNotifications->unreadCount($user)]);
    }
}
