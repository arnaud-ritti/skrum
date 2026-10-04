import { router } from '@inertiajs/react';
import { Send } from 'lucide-react';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { toast } from 'sonner';
import WorkspaceInvitationsController from '@/actions/App/Http/Controllers/WorkspaceInvitationsController';
import { FormDialog } from '@/components/skrum/confirm-dialog';
import { TextareaField, TextField } from '@/components/skrum/text-field';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { useRouterAction } from '@/components/workspaces/use-router-action';
import { useTrans } from '@/hooks/use-trans';
import { teamRoleLabel } from '@/lib/teams/roles';
import type { TeamRole, WorkspaceSummary } from '@/types';

const RoleFieldId = 'invitation-role';
const TeamFieldId = 'invitation-team';
const TeamRoleFieldId = 'invitation-team-role';
const MessageFieldId = 'invitation-message';

/** A select item cannot carry an empty value: this one stands for "No team". */
const NoTeam = 'none';

/** As long as the server takes. */
const MaxMessageLength = 500;

export type InviteTeamOption = { id: string; name: string };

/** The fields the form posts beside the address and the role, when filled. */
function optionalFields(data: FormData): Record<string, string> {
    const fields: Record<string, string> = {};
    const team = data.get('team_id');
    const teamRole = data.get('team_role');
    const message = data.get('message');

    if (typeof team === 'string' && team !== '' && team !== NoTeam) {
        fields.team_id = team;

        if (typeof teamRole === 'string' && teamRole !== '') {
            fields.team_role = teamRole;
        }
    }

    if (typeof message === 'string' && message.trim() !== '') {
        fields.message = message;
    }

    return fields;
}

/** IN-1: "Team · optional", and the role in that team once one is picked. */
export function InviteTeamFields({
    teams,
    teamRoles,
}: {
    teams: InviteTeamOption[];
    teamRoles: TeamRole[];
}) {
    const { t } = useTrans();
    const [team, setTeam] = useState(NoTeam);

    if (teams.length === 0) {
        return null;
    }

    return (
        <>
            <div className="flex min-w-0 flex-col gap-1.5">
                <Label htmlFor={TeamFieldId}>{t('Team · optional')}</Label>
                <Select name="team_id" value={team} onValueChange={setTeam}>
                    <SelectTrigger id={TeamFieldId} className="w-full">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value={NoTeam}>{t('No team')}</SelectItem>
                        {teams.map((option) => (
                            <SelectItem key={option.id} value={option.id}>
                                {option.name}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
            {team !== NoTeam && (
                <div className="flex min-w-0 flex-col gap-1.5">
                    <Label htmlFor={TeamRoleFieldId}>
                        {t('Role in the team')}
                    </Label>
                    <Select name="team_role" defaultValue="member">
                        <SelectTrigger id={TeamRoleFieldId} className="w-full">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {teamRoles.map((role) => (
                                <SelectItem key={role} value={role}>
                                    {teamRoleLabel(role, t)}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            )}
        </>
    );
}

/** IN-2: the inviter's message, last field of the form. */
export function InviteMessageField() {
    const { t } = useTrans();

    return (
        <TextareaField
            id={MessageFieldId}
            name="message"
            label={t('Message · optional')}
            maxLength={MaxMessageLength}
            rows={3}
        />
    );
}

/**
 * Places left for the features that come after the rewrite; nothing is
 * rendered while a slot is undefined.
 */
export type InviteSlots = {
    /** IN-1: the teams the invited person joins, under the role. */
    inviteTeamsField?: ReactNode;
    /** IN-2: the message of the inviter, last field of the form. */
    inviteMessageField?: ReactNode;
};

/** The invitation form, opened by "Invite" in the header of the members card. */
export function InviteDialog({
    open,
    onOpenChange,
    workspace,
    validForDays,
    slots = {},
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    workspace: WorkspaceSummary;
    /** How long the link works, as the server sets it. */
    validForDays: number;
    slots?: InviteSlots;
}) {
    const { t } = useTrans();
    const { run, error, reset } = useRouterAction();

    const invite = async (data: FormData): Promise<void> => {
        const emailField = data.get('email');
        const roleField = data.get('role');
        const email = typeof emailField === 'string' ? emailField : '';
        const role = typeof roleField === 'string' ? roleField : 'member';

        await run((options) =>
            router.post(
                WorkspaceInvitationsController.store.url(workspace.slug),
                { email, role, ...optionalFields(data) },
                options,
            ),
        );

        toast.success(t('Invitation created for :email.', { email }));
    };

    return (
        <FormDialog
            open={open}
            onOpenChange={(next) => {
                if (!next) {
                    reset();
                }

                onOpenChange(next);
            }}
            title={t('Invite people')}
            description={t(
                'They receive a link to join :workspace, valid for :count days.',
                { workspace: workspace.name, count: validForDays },
            )}
            submitLabel={t('Send invitation')}
            submitIcon={Send}
            submitTest="send-invitation"
            onSubmit={invite}
            error={error}
        >
            <TextField
                label={t('Email address')}
                type="email"
                name="email"
                required
                autoFocus
                maxLength={255}
                autoComplete="off"
            />
            <div className="flex min-w-0 flex-col gap-1.5">
                <Label htmlFor={RoleFieldId}>{t('Role')}</Label>
                <Select name="role" defaultValue="member">
                    <SelectTrigger id={RoleFieldId} className="w-full">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="member">{t('Member')}</SelectItem>
                        <SelectItem value="admin">{t('Admin')}</SelectItem>
                    </SelectContent>
                </Select>
            </div>
            {slots.inviteTeamsField}
            {slots.inviteMessageField}
        </FormDialog>
    );
}
