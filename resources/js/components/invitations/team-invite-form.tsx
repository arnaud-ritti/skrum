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
import { addChips } from '@/lib/invitations/email-chips';
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
 * The server keys an address's error by its index in the request: re-key it
 * by the address's index among the chips now, or drop it with its chip.
 */
function errorsOnCurrentChips(
    errors: Record<string, string | undefined>,
    sentEmails: string[],
    chips: EmailChip[],
): Record<string, string | undefined> {
    const result: Record<string, string | undefined> = {};

    for (const [key, text] of Object.entries(errors)) {
        const match = /^emails\.(\d+)$/.exec(key);

        if (match === null) {
            result[key] = text;

            continue;
        }

        const index = chips.findIndex(
            (chip) => chip.value === sentEmails[Number(match[1])],
        );

        if (index !== -1) {
            result[`emails.${index}`] = text;
        }
    }

    return result;
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
    const [draft, setDraft] = useState('');
    const [sentEmails, setSentEmails] = useState<string[]>([]);
    const [role, setRole] = useState<TeamRoleValue>(defaultRole);
    const [message, setMessage] = useState('');
    const [sending, setSending] = useState(false);
    const busy = processing || sending;
    const pendingChips = addChips(chips, draft);
    const validCount = pendingChips.filter((chip) => chip.isValid).length;
    const canSend =
        validCount > 0 && validCount === pendingChips.length && !busy;
    const fieldErrors = errorsOnCurrentChips(errors, sentEmails, chips);

    const submit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
        event.preventDefault();

        if (!canSend) {
            return;
        }

        const emails = pendingChips.map((chip) => chip.value);

        setChips(pendingChips);
        setDraft('');
        setSentEmails(emails);
        setSending(true);

        try {
            await onSubmit({
                emails,
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
                draft={draft}
                onDraftChange={setDraft}
                errors={fieldErrors}
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
