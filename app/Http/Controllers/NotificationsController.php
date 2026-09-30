<?php

namespace App\Http\Controllers;

use App\Actions\ActionItems\ListActionItemNotifications;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class NotificationsController extends Controller
{
    public function index(Request $request, ListActionItemNotifications $listActionItemNotifications): JsonResponse
    {
        return response()->json($listActionItemNotifications->handle($request->user()));
    }

    public function update(Request $request, string $notification): JsonResponse
    {
        $request->validate(['read' => ['required', 'accepted']]);

        $user = $request->user();

        $user->notifications()->findOrFail($notification)->markAsRead();

        return response()->json(['unreadCount' => $user->unreadNotifications()->count()]);
    }
}
