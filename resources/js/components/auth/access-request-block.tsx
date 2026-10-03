import { HttpResponseError } from '@inertiajs/core';
import { Link, useHttp, usePage } from '@inertiajs/react';
import { Check, LogOut, Send } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { toast } from 'sonner';
import InputError from '@/components/input-error';
import { LoadingButton } from '@/components/skrum/loading-button';
import { PersonAvatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useTrans } from '@/hooks/use-trans';
import { logout } from '@/routes';

/** The `accessRequest` prop of a 403 about a team of the viewer's workspace. */
export type AccessRequestOffer = {
    team: { id: string; name: string };
    workspace: { name: string };
    memberCount: number;
    /** Three at most, sorted by name. */
    managers: Array<{ name: string; avatarUrl: string }>;
    /** The managers not named. */
    managersMore: number;
    pending: boolean;
    storeUrl: string;
};

const MaxMessageLength = 500;

function TeamManagers({
    managers,
    more,
}: {
    managers: AccessRequestOffer['managers'];
    more: number;
}) {
    const { t } = useTrans();

    if (managers.length === 0) {
        return null;
    }

    const names = managers.map((manager) => manager.name).join(', ');

    return (
        <p
            data-slot="access-request-managers"
            className="inline-flex max-w-full min-w-0 items-center gap-2 text-xs text-muted-foreground"
        >
            <span
                aria-hidden="true"
                className="flex shrink-0 items-center -space-x-1.5 *:rounded-full *:ring-2 *:ring-background"
            >
                {managers.map((manager, index) => (
                    <PersonAvatar
                        key={`${index}-${manager.name}`}
                        name={manager.name}
                        src={manager.avatarUrl || undefined}
                        size="sm"
                        decorative
                    />
                ))}
            </span>
            <span className="min-w-0 text-left text-pretty">
                {more > 0
                    ? t('Team admins: :names and :count others', {
                          names,
                          count: more,
                      })
                    : t('Team admins: :names', { names })}
            </span>
        </p>
    );
}

/**
 * The 403 of a team the viewer's workspace holds: the team, a message to its
 * admins and the request, sent once.
 */
export function AccessRequestBlock({ offer }: { offer: AccessRequestOffer }) {
    const { t } = useTrans();
    const { auth } = usePage().props as {
        auth?: { user?: { email: string } | null };
    };
    const fieldId = useId();
    const errorId = useId();
    const request = useHttp<{ message: string }, { status: string }>({
        message: '',
    });
    const [sent, setSent] = useState(offer.pending);
    const [announcement, setAnnouncement] = useState('');
    const [failure, setFailure] = useState<string>();
    const sentButton = useRef<HTMLButtonElement>(null);
    const focusSentButton = useRef(false);
    const sentSentence = t(
        "Request sent. You'll see the answer in your notifications.",
    );
    const [beforeEmail, afterEmail = ''] = t(
        "You're signed in as :email. Ask for access and a team admin will review it.",
    ).split(':email');
    const members =
        offer.memberCount === 1
            ? t(':workspace workspace · 1 member', {
                  workspace: offer.workspace.name,
              })
            : t(':workspace workspace · :count members', {
                  workspace: offer.workspace.name,
                  count: offer.memberCount,
              });
    const error = request.errors.message ?? failure;

    useEffect(() => {
        if (!sent || !focusSentButton.current) {
            return;
        }

        focusSentButton.current = false;
        sentButton.current?.focus();
    }, [sent]);

    const send = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
        event.preventDefault();
        setFailure(undefined);

        let accepted = false;

        try {
            await request.post(offer.storeUrl, {
                onSuccess: () => {
                    accepted = true;
                },
                onError: (errors) => {
                    const refusal = Object.entries(errors).find(
                        ([field]) => field !== 'message',
                    )?.[1];

                    if (refusal !== undefined) {
                        setFailure(refusal);
                    }
                },
            });
        } catch (thrown) {
            setFailure(
                thrown instanceof HttpResponseError &&
                    thrown.response.status === 429
                    ? t('Too many access requests. Try again later.')
                    : t('Something went wrong. Please try again.'),
            );

            return;
        }

        if (!accepted) {
            return;
        }

        focusSentButton.current = true;
        setSent(true);
        setAnnouncement(sentSentence);
        toast.success(sentSentence);
    };

    return (
        <form
            data-slot="access-request"
            onSubmit={(event) => void send(event)}
            className="flex w-full min-w-0 flex-col items-center gap-3"
        >
            <div className="flex max-w-full min-w-0 items-center gap-3 rounded-lg border bg-card py-2 pr-4 pl-2">
                <span
                    aria-hidden="true"
                    data-slot="access-request-team-mark"
                    className="flex size-7.5 shrink-0 items-center justify-center rounded-md bg-sidebar-primary text-xs font-bold text-sidebar-primary-foreground"
                >
                    {offer.team.name.trim().charAt(0).toUpperCase()}
                </span>
                <span className="grid min-w-0 text-left">
                    <span className="truncate text-sm font-semibold">
                        {offer.team.name}
                    </span>
                    <span className="truncate text-xs text-muted-foreground">
                        {members}
                    </span>
                </span>
            </div>
            <p className="text-sm/snug text-pretty text-muted-foreground">
                {beforeEmail}
                <b className="font-semibold text-foreground">
                    {auth?.user?.email}
                </b>
                {afterEmail}
            </p>
            {!sent && (
                <div className="flex w-full max-w-96 flex-col gap-1.5 text-left">
                    <Label htmlFor={fieldId}>
                        {t('Message to the admins (optional)')}
                    </Label>
                    <Textarea
                        id={fieldId}
                        name="message"
                        rows={2}
                        maxLength={MaxMessageLength}
                        value={request.data.message}
                        onChange={(event) =>
                            request.setData('message', event.target.value)
                        }
                        aria-invalid={error !== undefined || undefined}
                        aria-describedby={
                            error !== undefined ? errorId : undefined
                        }
                    />
                    <InputError id={errorId} message={error} />
                </div>
            )}
            <div
                data-slot="access-request-actions"
                className="mt-1 flex flex-wrap items-center justify-center gap-2 max-sm:w-full max-sm:flex-col max-sm:items-stretch"
            >
                {sent ? (
                    <Button
                        ref={sentButton}
                        type="button"
                        aria-disabled="true"
                        className="opacity-50"
                    >
                        <Check />
                        <span className="truncate">{t('Request sent')}</span>
                    </Button>
                ) : (
                    <LoadingButton type="submit" loading={request.processing}>
                        <Send />
                        <span className="truncate">{t('Request access')}</span>
                    </LoadingButton>
                )}
                <Button asChild variant="ghost">
                    <Link href={logout()} as="button">
                        <LogOut />
                        <span className="truncate">{t('Switch account')}</span>
                    </Link>
                </Button>
            </div>
            <span role="status" aria-live="polite" className="sr-only">
                {announcement}
            </span>
            <TeamManagers managers={offer.managers} more={offer.managersMore} />
        </form>
    );
}
