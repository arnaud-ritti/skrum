import { RefreshCw, UserSearch } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import IntegrationUserMappingsController from '@/actions/App/Http/Controllers/Integrations/IntegrationUserMappingsController';
import IntegrationUserMatchesController from '@/actions/App/Http/Controllers/Integrations/IntegrationUserMatchesController';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Spinner } from '@/components/ui/spinner';
import { useTrans } from '@/hooks/use-trans';
import { integrationErrorMessage } from '@/lib/integrations';
import { retroRequest } from '@/lib/retro/api';
import type {
    IntegrationProviderKey,
    IntegrationScope,
    TeamIntegration,
    UserMapping,
    UserMappingRow,
    UserMappings,
} from '@/types';
import { AccountPickerDialog } from './account-picker-dialog';

/** Spec §11: the page polls every 5 s while email matching runs. */
const MatchingPollMs = 5_000;

type Props = {
    scope: IntegrationScope;
    connection: TeamIntegration;
    providerLabel: string;
};

function MappingBadge({ row }: { row: UserMappingRow }) {
    const { t } = useTrans();
    const mapping = row.mapping;

    if (mapping === null) {
        return <Badge variant="outline">{t('Not mapped')}</Badge>;
    }

    if (mapping.accountInactive) {
        return <Badge variant="destructive">{t('Account inactive')}</Badge>;
    }

    if (mapping.accountId === null) {
        return <Badge variant="secondary">{t('Never assign')}</Badge>;
    }

    const matchedBy: Record<UserMapping['matchedBy'], string> = {
        email: t('Matched by email'),
        manual: t('Set manually'),
        sso: t('Linked via GitHub sign-in'),
    };

    return <Badge variant="secondary">{matchedBy[mapping.matchedBy]}</Badge>;
}

type Translate = ReturnType<typeof useTrans>['t'];

function matchingHint(provider: IntegrationProviderKey, t: Translate): string {
    switch (provider) {
        case 'jira':
            return t("Jira: members' emails are looked up on your Jira site.");
        case 'jira_dc':
            return t(
                "Jira Data Center: members' emails are looked up on your Jira server.",
            );
        case 'github':
            return t(
                'GitHub: members who signed in to skrum with GitHub are matched automatically.',
            );
        default:
            return t('Linear: emails are compared on this server.');
    }
}

export function PeoplePanel({ scope, connection, providerLabel }: Props) {
    const { t } = useTrans();
    const [data, setData] = useState<UserMappings | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [busyUser, setBusyUser] = useState<string | null>(null);
    const [picking, setPicking] = useState<UserMappingRow | null>(null);
    const [revision, setRevision] = useState(0);
    const { workspace, team } = scope;
    const integration = connection.id;
    const matching = data?.matching ?? false;

    useEffect(() => {
        let cancelled = false;

        retroRequest<UserMappings>(
            IntegrationUserMappingsController.index({
                workspace,
                team,
                integration,
            }),
        )
            .then((loaded) => {
                if (!cancelled) {
                    setData(loaded);
                    setError(null);
                }
            })
            .catch((failure: unknown) => {
                if (!cancelled) {
                    setError(
                        integrationErrorMessage(
                            failure,
                            t('Could not load the people of this team.'),
                        ),
                    );
                }
            });

        return () => {
            cancelled = true;
        };
    }, [workspace, team, integration, revision, t]);

    useEffect(() => {
        if (!matching) {
            return;
        }

        const timer = setInterval(
            () => setRevision((current) => current + 1),
            MatchingPollMs,
        );

        return () => clearInterval(timer);
    }, [matching]);

    const replaceRow = (row: UserMappingRow) =>
        setData((current) =>
            current === null
                ? current
                : {
                      ...current,
                      members: current.members.map((member) =>
                          member.userId === row.userId ? row : member,
                      ),
                  },
        );

    const fail = (failure: unknown) =>
        toast.error(
            integrationErrorMessage(failure, t('Something went wrong.')),
        );

    const save = async (row: UserMappingRow, accountId: string | null) => {
        setBusyUser(row.userId);

        try {
            replaceRow(
                await retroRequest<UserMappingRow>(
                    IntegrationUserMappingsController.update({
                        workspace,
                        team,
                        integration,
                        user: row.userId,
                    }),
                    { external_account_id: accountId },
                ),
            );
        } catch (failure) {
            fail(failure);
        } finally {
            setBusyUser(null);
        }
    };

    const reset = async (row: UserMappingRow) => {
        setBusyUser(row.userId);

        try {
            await retroRequest(
                IntegrationUserMappingsController.destroy({
                    workspace,
                    team,
                    integration,
                    user: row.userId,
                }),
            );
            replaceRow({ ...row, mapping: null });
        } catch (failure) {
            fail(failure);
        } finally {
            setBusyUser(null);
        }
    };

    const matchByEmail = async () => {
        try {
            await retroRequest(
                IntegrationUserMatchesController.store({
                    workspace,
                    team,
                    integration,
                }),
            );
            setData((current) =>
                current === null ? current : { ...current, matching: true },
            );
        } catch (failure) {
            fail(failure);
        }
    };

    return (
        <section className="space-y-3 border-t pt-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                    <h3 className="text-sm font-medium">{t('People')}</h3>
                    <p className="text-xs text-muted-foreground">
                        {matchingHint(connection.provider, t)}
                    </p>
                </div>
                <Button
                    variant="outline"
                    size="sm"
                    disabled={matching || data === null}
                    onClick={() => void matchByEmail()}
                >
                    {matching ? (
                        <Spinner />
                    ) : (
                        <RefreshCw className="size-4" aria-hidden />
                    )}
                    {connection.provider === 'github'
                        ? t('Match GitHub sign-ins')
                        : t('Match by email')}
                </Button>
            </div>
            {error !== null && (
                <p className="text-sm text-destructive">{error}</p>
            )}
            {data === null && error === null && <Spinner />}
            {data !== null && (
                <ul className="divide-y rounded-md border">
                    {data.members.map((row) => (
                        <li
                            key={row.userId}
                            className="flex flex-wrap items-center gap-3 p-2 text-sm"
                        >
                            <Avatar className="size-6">
                                <AvatarImage src={row.avatarUrl} alt="" />
                                <AvatarFallback />
                            </Avatar>
                            <div className="min-w-0 flex-1">
                                <p className="truncate font-medium">
                                    {row.name}
                                </p>
                                <p className="truncate text-xs text-muted-foreground">
                                    {row.email}
                                </p>
                            </div>
                            <div className="flex min-w-0 items-center gap-2">
                                {row.mapping?.displayName && (
                                    <span className="truncate">
                                        {row.mapping.displayName}
                                    </span>
                                )}
                                <MappingBadge row={row} />
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="size-7"
                                            disabled={busyUser === row.userId}
                                            aria-label={t(
                                                'Change the :provider account of :name',
                                                {
                                                    provider: providerLabel,
                                                    name: row.name,
                                                },
                                            )}
                                        >
                                            {busyUser === row.userId ? (
                                                <Spinner />
                                            ) : (
                                                <UserSearch
                                                    className="size-4"
                                                    aria-hidden
                                                />
                                            )}
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                        <DropdownMenuItem
                                            onSelect={() => setPicking(row)}
                                        >
                                            {t('Choose an account…')}
                                        </DropdownMenuItem>
                                        <DropdownMenuItem
                                            onSelect={() =>
                                                void save(row, null)
                                            }
                                        >
                                            {t('Never assign')}
                                        </DropdownMenuItem>
                                        {row.mapping !== null && (
                                            <DropdownMenuItem
                                                onSelect={() => void reset(row)}
                                            >
                                                {t('Reset')}
                                            </DropdownMenuItem>
                                        )}
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>
                        </li>
                    ))}
                </ul>
            )}
            {picking !== null && (
                <AccountPickerDialog
                    scope={scope}
                    connection={connection}
                    providerLabel={providerLabel}
                    memberName={picking.name}
                    onClose={() => setPicking(null)}
                    onChoose={(accountId) => {
                        const row = picking;

                        setPicking(null);
                        void save(row, accountId);
                    }}
                />
            )}
        </section>
    );
}
