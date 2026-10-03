import { PersonAvatar } from '@/components/ui/avatar';
import type { User } from '@/types';

export function UserInfo({
    user,
    showEmail = false,
    role = null,
}: {
    user: User;
    showEmail?: boolean;
    /** The sidebar card's second line: the team and workspace roles. */
    role?: string | null;
}) {
    return (
        <>
            <PersonAvatar
                name={user.name}
                src={user.avatarUrl}
                size="md"
                decorative
            />
            <div className="grid min-w-0 flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">{user.name}</span>
                {role !== null && (
                    <span
                        data-slot="user-card-role"
                        className="truncate text-xs text-muted-foreground"
                    >
                        {role}
                    </span>
                )}
                {showEmail && (
                    <span className="truncate text-xs text-muted-foreground">
                        {user.email}
                    </span>
                )}
            </div>
        </>
    );
}
