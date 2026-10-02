import { router } from '@inertiajs/react';
import { Send } from 'lucide-react';
import type { ReactNode } from 'react';
import { toast } from 'sonner';
import WorkspaceInvitationsController from '@/actions/App/Http/Controllers/WorkspaceInvitationsController';
import { FormDialog } from '@/components/skrum/confirm-dialog';
import { TextField } from '@/components/skrum/text-field';
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
import type { WorkspaceSummary } from '@/types';

const RoleFieldId = 'invitation-role';

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
    slots = {},
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    workspace: WorkspaceSummary;
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
                { email, role },
                options,
            ),
        );

        toast.success(t('Invitation sent to :email.', { email }));
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
                'They receive a link to join :workspace, valid for 7 days.',
                { workspace: workspace.name },
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
