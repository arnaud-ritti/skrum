import { useEffect, useState } from 'react';
import IntegrationAccountsController from '@/actions/App/Http/Controllers/Integrations/IntegrationAccountsController';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { useTrans } from '@/hooks/use-trans';
import { integrationErrorMessage } from '@/lib/integrations';
import { retroRequest } from '@/lib/retro/api';
import type {
    ExternalAccount,
    IntegrationScope,
    TeamIntegration,
} from '@/types';

const SearchDelayMs = 300;

const MinimumQueryLength = 2;

type Props = {
    scope: IntegrationScope;
    connection: TeamIntegration;
    providerLabel: string;
    memberName: string;
    onClose: () => void;
    onChoose: (accountId: string) => void;
};

export function AccountPickerDialog({
    scope,
    connection,
    providerLabel,
    memberName,
    onClose,
    onChoose,
}: Props) {
    const { t } = useTrans();
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<ExternalAccount[]>([]);
    const [searching, setSearching] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const { workspace, team } = scope;
    const integration = connection.id;
    const trimmed = query.trim();
    const searchable = trimmed.length >= MinimumQueryLength;

    useEffect(() => {
        if (trimmed.length < MinimumQueryLength) {
            return;
        }

        let cancelled = false;
        const timer = setTimeout(() => {
            setSearching(true);

            retroRequest<ExternalAccount[]>(
                IntegrationAccountsController.index(
                    { workspace, team, integration },
                    { query: { q: trimmed } },
                ),
            )
                .then((found) => {
                    if (!cancelled) {
                        setResults(found);
                        setError(null);
                    }
                })
                .catch((failure: unknown) => {
                    if (!cancelled) {
                        setError(
                            integrationErrorMessage(
                                failure,
                                t('Something went wrong.'),
                            ),
                        );
                    }
                })
                .finally(() => {
                    if (!cancelled) {
                        setSearching(false);
                    }
                });
        }, SearchDelayMs);

        return () => {
            cancelled = true;
            clearTimeout(timer);
        };
    }, [trimmed, workspace, team, integration, t]);

    return (
        <Dialog
            open
            onOpenChange={(open) => {
                if (!open) {
                    onClose();
                }
            }}
        >
            <DialogContent>
                <DialogTitle>
                    {t(':provider account of :name', {
                        provider: providerLabel,
                        name: memberName,
                    })}
                </DialogTitle>
                <DialogDescription>
                    {t('Search by name or email. Emails are not shown.')}
                </DialogDescription>
                <Input
                    autoFocus
                    value={query}
                    maxLength={100}
                    placeholder={t('Search')}
                    aria-label={t('Search')}
                    onChange={(event) => setQuery(event.target.value)}
                />
                {error !== null && (
                    <p className="text-sm text-destructive">{error}</p>
                )}
                {searchable && searching && <Spinner />}
                {searchable &&
                    !searching &&
                    error === null &&
                    results.length === 0 && (
                        <p className="text-sm text-muted-foreground">
                            {t('No account found.')}
                        </p>
                    )}
                {searchable && (
                    <ul className="max-h-64 space-y-1 overflow-y-auto">
                        {results.map((account) => (
                            <li key={account.accountId}>
                                <Button
                                    variant="ghost"
                                    className="w-full justify-start"
                                    onClick={() => onChoose(account.accountId)}
                                >
                                    {account.displayName}
                                </Button>
                            </li>
                        ))}
                    </ul>
                )}
            </DialogContent>
        </Dialog>
    );
}
