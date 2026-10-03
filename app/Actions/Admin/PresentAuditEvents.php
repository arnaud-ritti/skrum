<?php

namespace App\Actions\Admin;

use App\Enums\AuditAction;
use App\Models\AuditEvent;
use App\Models\User;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Builder;

class PresentAuditEvents
{
    private const int PerPage = 50;

    private const string UserSubject = 'User';

    /**
     * The events newest first; an actor whose account is gone keeps the name recorded with the event,
     * an event without any actor is the system's.
     *
     * @return LengthAwarePaginator<int, array{
     *     id: string,
     *     action: string,
     *     group: string,
     *     actor: ?array{name: string, avatarUrl: ?string},
     *     subject: ?array{type: string, id: ?string, label: ?string},
     *     properties: array<string, mixed>,
     *     ip: ?string,
     *     at: string
     * }>
     */
    public function handle(?string $group, ?string $actorId): LengthAwarePaginator
    {
        $events = AuditEvent::query()
            ->with('actor')
            ->when($group !== null, fn (Builder $query) => $query->whereIn('action', AuditAction::inGroup((string) $group)))
            ->when($actorId !== null, fn (Builder $query) => $query->where('actor_user_id', $actorId))
            ->orderByDesc('created_at')
            ->orderByDesc('id')
            ->paginate(self::PerPage)
            ->withQueryString();

        $subjectNames = $this->userSubjectNames($events->getCollection()->all());

        return $events->through(fn (AuditEvent $event): array => [
            'id' => $event->id,
            'action' => $event->action->value,
            'group' => $event->action->group(),
            'actor' => $this->actor($event),
            'subject' => $event->subject_type === null ? null : [
                'type' => $event->subject_type,
                'id' => $event->subject_id,
                'label' => $event->subject_type === self::UserSubject ? ($subjectNames[$event->subject_id] ?? null) : null,
            ],
            'properties' => $event->properties ?? [],
            'ip' => $event->ip_address,
            'at' => $event->created_at->toIso8601String(),
        ]);
    }

    /**
     * @return ?array{name: string, avatarUrl: ?string}
     */
    private function actor(AuditEvent $event): ?array
    {
        if ($event->actor !== null) {
            return ['name' => $event->actor->name, 'avatarUrl' => $event->actor->avatarUrl()];
        }

        if ($event->actor_name === '') {
            return null;
        }

        return ['name' => $event->actor_name, 'avatarUrl' => null];
    }

    /**
     * @param  array<int, AuditEvent>  $events
     * @return array<string, string>
     */
    private function userSubjectNames(array $events): array
    {
        $ids = collect($events)
            ->filter(fn (AuditEvent $event): bool => $event->subject_type === self::UserSubject && $event->subject_id !== null)
            ->pluck('subject_id')
            ->unique()
            ->values()
            ->all();

        if ($ids === []) {
            return [];
        }

        /** @var array<string, string> */
        return User::query()->whereIn('id', $ids)->pluck('name', 'id')->all();
    }
}
