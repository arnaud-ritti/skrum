import { Badge } from '@/components/ui/badge';
import { useTrans } from '@/hooks/use-trans';
import { teamRoleLabel } from '@/lib/teams/roles';
import type { TeamRole } from '@/types';

/** The role of a member at the end of its row; a plain member has none, as in ScreenTeam. */
export function TeamRoleBadge({ role }: { role: TeamRole | undefined }) {
    const { t } = useTrans();

    if (role === undefined || role === 'member') {
        return null;
    }

    return (
        <Badge data-test="member-role" variant="soft" className="shrink-0">
            {teamRoleLabel(role, t)}
        </Badge>
    );
}
