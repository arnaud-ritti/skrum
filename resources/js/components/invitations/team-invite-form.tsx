import { CircleAlert, Send } from 'lucide-react';
import { useId, useState } from 'react';
import type { ComponentProps, FormEvent } from 'react';
import { InviteLinkBlock } from '@/components/invitations/invite-link-block';
import { EmailChipsField } from '@/components/skrum/email-chips-field';
import { LoadingButton } from '@/components/skrum/loading-button';
import { TextareaField } from '@/components/skrum/text-field';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { useTrans } from '@/hooks/use-trans';
import type { EmailChip } from '@/lib/invitations/email-chips';
import type {
    TeamInvitationPayload,
    TeamMarkData,
    TeamRoleValue,
} from '@/lib/invitations/types';
import { teamRoleLabel } from '@/lib/teams/roles';

/** As long as the server takes. */
export const MaxInvitationMessageLength = 500;

type Translate = ReturnType<typeof useTrans>['t'];

function roleSentence(role: TeamRoleValue, team: string, t: Translate): string {
    switch (role) {
        case 'owner':
            return t('They join :team as owners.', { team });
        case 'facilitator':
            return t('They join :team as facilitators.', { team });
        case 'member':
            return t('They join :team as members.', { team });
        case 'observer':
            return t('They join :team as observers.', { team });
    }
}

function submitLabel(count: number, t: Translate): string {
    if (count === 0) {
        return t('Send invitations');
    }

    if (count === 1) {
        return t('Send one invitation');
    }

    return t('Send :count invitations', { count });
}

/**
 * Onboarding step 3 and the team's invite dialog: the address chips, the
 * team role, the message, the team's link and the actions. `onSubmit` may
 * return a promise: the chips and the message are cleared once it resolves,
 * kept when it rejects.
 */
export function TeamInviteForm({
    team,
    roles,
    defaultRole = 'member',
    inviteLink,
    onSubmit,
    onSkip,
    errors = {},
    processing = false,
}: {
    team: TeamMarkData;
    roles: TeamRoleValue[];
    defaultRole?: TeamRoleValue;
    inviteLink: ComponentProps<typeof InviteLinkBlock>;
    onSubmit: (payload: TeamInvitationPayload) => Promise<void> | void;
    onSkip?: () => void;
    errors?: Record<string, string | undefined>;
    processing?: boolean;
}) {
    const { t } = useTrans();
    const fieldId = useId();
    const [chips, setChips] = useState<EmailChip[]>([]);
    const [role, setRole] = useState<TeamRoleValue>(defaultRole);
    const [message, setMessage] = useState('');
    const [sending, setSending] = useState(false);
    const busy = processing || sending;
    const validCount = chips.filter((chip) => chip.isValid).length;
    const canSend = validCount > 0 && validCount === chips.length && !busy;

    const submit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
        event.preventDefault();

        if (!canSend) {
            return;
        }

        setSending(true);

        try {
            await onSubmit({
                emails: chips.map((chip) => chip.value),
                role,
                message,
            });
            setChips([]);
            setMessage('');
        } catch {
            return;
        } finally {
            setSending(false);
        }
    };

    return (
        <form
            data-slot="team-invite-form"
            noValidate
            onSubmit={(event) => void submit(event)}
            className="flex min-w-0 flex-col gap-5"
        >
            <EmailChipsField
                id={`${fieldId}-emails`}
                label={t('Emails')}
                chips={chips}
                onChange={setChips}
                errors={errors}
                disabled={busy}
            />
            <div className="flex min-w-0 flex-col gap-1.5">
                <Label htmlFor={`${fieldId}-role`}>{t('Role')}</Label>
                <Select
                    value={role}
                    onValueChange={(value) => setRole(value as TeamRoleValue)}
                    disabled={busy}
                >
                    <SelectTrigger
                        id={`${fieldId}-role`}
                        aria-invalid={
                            errors.role === undefined ? undefined : true
                        }
                        className="w-full"
                    >
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {roles.map((value) => (
                            <SelectItem key={value} value={value}>
                                {teamRoleLabel(value, t)}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                {errors.role === undefined ? (
                    <span className="text-body-sm text-muted-foreground">
                        {roleSentence(role, team.name, t)}
                    </span>
                ) : (
                    <span className="flex items-center gap-1.5 text-body-sm text-skrum-destructive-text">
                        <CircleAlert
                            className="size-4 shrink-0"
                            aria-hidden="true"
                        />
                        {errors.role}
                    </span>
                )}
            </div>
            <TextareaField
                id={`${fieldId}-message`}
                label={t('Message · optional')}
                maxLength={MaxInvitationMessageLength}
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                error={errors.message}
                disabled={busy}
                rows={3}
            />
            <InviteLinkBlock {...inviteLink} />
            <div className="flex flex-wrap items-center justify-end gap-2">
                {onSkip !== undefined && (
                    <Button
                        type="button"
                        variant="ghost"
                        disabled={busy}
                        onClick={onSkip}
                    >
                        {t('Skip')}
                    </Button>
                )}
                <LoadingButton type="submit" loading={busy} disabled={!canSend}>
                    {!busy && <Send aria-hidden="true" />}
                    {submitLabel(validCount, t)}
                </LoadingButton>
            </div>
        </form>
    );
}
