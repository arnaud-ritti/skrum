import type { ColumnColor } from '@/lib/retro/types';
import type { TeamRole } from '@/types';

export type TeamRoleValue = TeamRole;

/** The team's usable invite link; no use limit (decision 3 C), the joins counted. */
export type InviteLink = { url: string; expiresAt: string; usesCount: number };

export type PendingInvitation = {
    id: string;
    email: string;
    teamRole: TeamRoleValue | null;
    status: 'pending' | 'expired' | 'declined';
    invitedAt: string;
    team?: { id: string; name: string } | null;
};

export type TeamMarkData = {
    name: string;
    initial: string;
    color: ColumnColor;
};

export type TeamInvitationPayload = {
    emails: string[];
    role: TeamRoleValue;
    message: string;
};

/** The team's session in progress, flashed once after landing on the team (P25-10). */
export type LiveSessionFlash = {
    kind: 'retro' | 'poker' | 'whiteboard' | 'survey' | 'icebreaker';
    title: string;
    url: string;
};
