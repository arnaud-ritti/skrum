<?php

namespace App\Http\Controllers;

use App\Actions\Teams\AccessRequestRecipients;
use App\Actions\Teams\AnswerTeamAccessRequest;
use App\Actions\Teams\RequestTeamAccess;
use App\Http\Requests\TeamAccessRequestStoreRequest;
use App\Http\Requests\TeamAccessRequestUpdateRequest;
use App\Models\Team;
use App\Models\TeamAccessRequest;
use App\Models\User;
use App\Models\Workspace;
use App\Notifications\TeamAccessAnsweredNotification;
use App\Notifications\TeamAccessRequestedNotification;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Notification;

class TeamAccessRequestsController extends Controller
{
    /**
     * The managers are told once, when the request is made: asking again
     * while it waits returns the same request and notifies nobody.
     */
    public function store(TeamAccessRequestStoreRequest $request, Workspace $workspace, Team $team, RequestTeamAccess $requestTeamAccess, AccessRequestRecipients $recipients): JsonResponse
    {
        /** @var User $requester */
        $requester = $request->user();

        $accessRequest = $requestTeamAccess->handle($requester, $team, $request->validated('message'));

        if ($accessRequest->wasRecentlyCreated) {
            Notification::send(
                $recipients->for($team)->reject(fn (User $recipient): bool => $recipient->is($requester)),
                new TeamAccessRequestedNotification($accessRequest->id),
            );
        }

        return response()->json(['status' => $accessRequest->status->value], 201);
    }

    public function update(TeamAccessRequestUpdateRequest $request, Workspace $workspace, Team $team, TeamAccessRequest $accessRequest, AnswerTeamAccessRequest $answer): JsonResponse
    {
        /** @var User $manager */
        $manager = $request->user();

        $status = $answer->handle($manager, $accessRequest, $request->validated('decision') === 'approve');

        $accessRequest->user->notify(new TeamAccessAnsweredNotification($accessRequest->id));

        return response()->json(['status' => $status->value]);
    }
}
