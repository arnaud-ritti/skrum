<?php

namespace App\Actions\ActionItems;

use App\Models\ActionItem;
use App\Models\Retro;
use App\Models\Team;
use Illuminate\Validation\ValidationException;

class ResolveActionItemAssignee
{
    /**
     * Member participants are stored as their user; only guests of the
     * item's own retro stay participant assignees.
     *
     * @param  array<string, mixed>  $validated
     * @return array{assignee_user_id: ?string, assignee_participant_id: ?string}|null
     */
    public function handle(Team $team, ?Retro $retro, array $validated, ?ActionItem $current = null): ?array
    {
        if (! array_key_exists('assignee_user_id', $validated) && ! array_key_exists('assignee_participant_id', $validated)) {
            return null;
        }

        $userId = $validated['assignee_user_id'] ?? null;
        $participantId = $validated['assignee_participant_id'] ?? null;

        if ($userId !== null && $participantId !== null) {
            throw ValidationException::withMessages([
                'assignee_user_id' => __('Choose either a team member or a guest as assignee, not both.'),
            ]);
        }

        if ($participantId !== null) {
            return $this->fromParticipant($team, $retro, (string) $participantId, $current);
        }

        if ($userId === null) {
            return ['assignee_user_id' => null, 'assignee_participant_id' => null];
        }

        $this->ensureTeamMember($team, (string) $userId, $current, 'assignee_user_id');

        return ['assignee_user_id' => (string) $userId, 'assignee_participant_id' => null];
    }

    /**
     * @return array{assignee_user_id: ?string, assignee_participant_id: ?string}
     */
    private function fromParticipant(Team $team, ?Retro $retro, string $participantId, ?ActionItem $current): array
    {
        $participant = $retro?->participants()->whereKey($participantId)->first();

        if ($participant === null) {
            throw ValidationException::withMessages([
                'assignee_participant_id' => __('The assignee must be a participant of this retrospective.'),
            ]);
        }

        if ($participant->user_id === null) {
            return ['assignee_user_id' => null, 'assignee_participant_id' => $participant->id];
        }

        $this->ensureTeamMember($team, $participant->user_id, $current, 'assignee_participant_id');

        return ['assignee_user_id' => $participant->user_id, 'assignee_participant_id' => null];
    }

    /**
     * An assignee who has since left the team may stay; nobody outside the
     * team can be picked.
     */
    private function ensureTeamMember(Team $team, string $userId, ?ActionItem $current, string $field): void
    {
        if ($current?->assignee_user_id === $userId) {
            return;
        }

        if ($team->members()->whereKey($userId)->exists()) {
            return;
        }

        throw ValidationException::withMessages([$field => __('The assignee must be a member of this team.')]);
    }
}
