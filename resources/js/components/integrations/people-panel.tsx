import { RefreshCw, RotateCcw, UserSearch, UserX } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import IntegrationUserMappingsController from '@/actions/App/Http/Controllers/Integrations/IntegrationUserMappingsController';
import IntegrationUserMatchesController from '@/actions/App/Http/Controllers/Integrations/IntegrationUserMatchesController';
import { LoadingButton } from '@/components/skrum/loading-button';
import { PersonAvatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import { PanelError, PanelLoading, TrackerPanel } from './tracker-parts';

/** Spec §11: the page polls every 5 s while email matching runs. */
const MatchingPollMs = 5_000;

type Props = {
    scope: IntegrationScope;
    connection: TeamIntegration;
    providerLabel: string;
};

type Failure = { error: unknown };

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
        return <Badge variant="muted">{t('Never assign')}</Badge>;
    }

    const matchedBy: Record<UserMapping['matchedBy'], string> = {
        email: t('Matched by email'),
        manual: t('Set manually'),
        sso: t('Linked via GitHub sign-in'),
    };

    return <Badge variant="success">{matchedBy[mapping.matchedBy]}</Badge>;
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

/**
 * The members stay a list, one item per member: three attributes do not make
 * a table, and the browser suite reads each member as a list item.
 */
export function PeoplePanel({ scope, connection, providerLabel }: Props) {
    const { t } = useTrans();
    const [data, setData] = useState<UserMappings | null>(null);
    const [failure, setFailure] = useState<Failure | null>(null);
    const [busyUser, setBusyUser] = useState<string | null>(null);
    const [picking, setPicking] = useState<UserMappingRow | null>(null);
    const [revision, setRevision] = useState(0);
    const [startingMatch, setStartingMatch] = useState(false);
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
                    setFailure(null);
                }
            })
            .catch((error: unknown) => {
                if (!cancelled) {
                    setFailure({ error });
                }
            });

        return () => {
            cancelled = true;
        };
    }, [workspace, team, integration, revision]);

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

    const retry = () => {
        setFailure(null);
        setRevision((current) => current + 1);
    };

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

    const fail = (error: unknown) =>
        toast.error(integrationErrorMessage(error, t('Something went wrong.')));

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
        } catch (error) {
            fail(error);
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
        } catch (error) {
            fail(error);
        } finally {
            setBusyUser(null);
        }
    };

    const matchByEmail = async () => {
        setStartingMatch(true);

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
        } catch (error) {
            fail(error);
        } finally {
            setStartingMatch(false);
        }
    };

    return (
        <TrackerPanel
            slot="tracker-people"
            title={t('People')}
            description={matchingHint(connection.provider, t)}
            action={
                <LoadingButton
                    type="button"
                    variant="outline"
                    size="sm"
                    className="max-w-full"
                    loading={matching || startingMatch}
                    disabled={data === null}
                    onClick={() => void matchByEmail()}
                >
                    <RefreshCw aria-hidden="true" />
                    <span className="truncate">
                        {connection.provider === 'github'
                            ? t('Match GitHub sign-ins')
                            : t('Match by email')}
                    </span>
                </LoadingButton>
            }
        >
            {failure !== null && (
                <PanelError
                    message={integrationErrorMessage(
                        failure.error,
                        t('Could not load the people of this team.'),
                    )}
                    retryLabel={t('Retry')}
                    onRetry={retry}
                />
            )}
            {data === null && failure === null && <PanelLoading />}
            {data !== null && data.members.length === 0 && (
                <p className="text-sm text-muted-foreground">
                    {t('This team has no member yet.')}
                </p>
            )}
            {data !== null && data.members.length > 0 && (
                <ul className="flex min-w-0 flex-col divide-y rounded-lg border">
                    {data.members.map((row) => (
                        <li
                            key={row.userId}
                            className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2.5 text-sm"
                        >
                            <div className="flex min-w-0 flex-1 basis-48 items-center gap-2.5">
                                <PersonAvatar
                                    decorative
                                    size="sm"
                                    name={row.name}
                                    src={row.avatarUrl}
                                />
                                <div className="grid min-w-0 flex-1">
                                    <span className="truncate font-medium">
                                        {row.name}
                                    </span>
                                    <span className="truncate text-body-sm text-muted-foreground">
                                        {row.email}
                                    </span>
                                </div>
                            </div>
                            <div className="flex min-w-0 flex-wrap items-center justify-end gap-2">
                                {row.mapping?.displayName && (
                                    <span className="min-w-0 truncate">
                                        {row.mapping.displayName}
                                    </span>
                                )}
                                <MappingBadge row={row} />
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <LoadingButton
                                            type="button"
                                            variant="ghost"
                                            size="icon-sm"
                                            className="shrink-0 text-muted-foreground"
                                            loading={busyUser === row.userId}
                                            aria-label={t(
                                                'Change the :provider account of :name',
                                                {
                                                    provider: providerLabel,
                                                    name: row.name,
                                                },
                                            )}
                                        >
                                            <UserSearch aria-hidden="true" />
                                        </LoadingButton>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                        <DropdownMenuItem
                                            onSelect={() => setPicking(row)}
                                        >
                                            <UserSearch aria-hidden="true" />
                                            {t('Choose an account…')}
                                        </DropdownMenuItem>
                                        <DropdownMenuItem
                                            onSelect={() =>
                                                void save(row, null)
                                            }
                                        >
                                            <UserX aria-hidden="true" />
                                            {t('Never assign')}
                                        </DropdownMenuItem>
                                        {row.mapping !== null && (
                                            <DropdownMenuItem
                                                onSelect={() => void reset(row)}
                                            >
                                                <RotateCcw aria-hidden="true" />
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
        </TrackerPanel>
    );
}
