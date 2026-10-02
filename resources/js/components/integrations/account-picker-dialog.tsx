import { Search } from 'lucide-react';
import { useEffect, useState } from 'react';
import IntegrationAccountsController from '@/actions/App/Http/Controllers/Integrations/IntegrationAccountsController';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
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

type Failure = { error: unknown };

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
    const [answered, setAnswered] = useState('');
    const [failure, setFailure] = useState<Failure | null>(null);
    const { workspace, team } = scope;
    const integration = connection.id;
    const trimmed = query.trim();
    const searchable = trimmed.length >= MinimumQueryLength;
    /** From the keystroke on, debounce included: no answer yet for what is typed. */
    const searching = searchable && answered !== trimmed;

    useEffect(() => {
        if (trimmed.length < MinimumQueryLength) {
            return;
        }

        let cancelled = false;
        const timer = setTimeout(() => {
            retroRequest<ExternalAccount[]>(
                IntegrationAccountsController.index(
                    { workspace, team, integration },
                    { query: { q: trimmed } },
                ),
            )
                .then((found) => {
                    if (!cancelled) {
                        setResults(found);
                        setFailure(null);
                    }
                })
                .catch((error: unknown) => {
                    if (!cancelled) {
                        setFailure({ error });
                    }
                })
                .finally(() => {
                    if (!cancelled) {
                        setAnswered(trimmed);
                    }
                });
        }, SearchDelayMs);

        return () => {
            cancelled = true;
            clearTimeout(timer);
        };
    }, [trimmed, workspace, team, integration]);

    return (
        <Dialog
            open
            onOpenChange={(open) => {
                if (!open) {
                    onClose();
                }
            }}
        >
            <DialogContent size="sm" closeLabel={t('Close')}>
                <DialogHeader className="pr-8">
                    <DialogTitle>
                        {t(':provider account of :name', {
                            provider: providerLabel,
                            name: memberName,
                        })}
                    </DialogTitle>
                    <DialogDescription>
                        {t('Search by name or email. Emails are not shown.')}
                    </DialogDescription>
                </DialogHeader>
                <div className="relative flex items-center">
                    <Search
                        aria-hidden="true"
                        className="pointer-events-none absolute left-2.5 size-4 text-muted-foreground"
                    />
                    <Input
                        autoFocus
                        type="search"
                        className="pl-8"
                        value={query}
                        maxLength={100}
                        placeholder={t('Search')}
                        aria-label={t('Search')}
                        onChange={(event) => setQuery(event.target.value)}
                    />
                </div>
                <div
                    aria-live="polite"
                    data-slot="account-results"
                    className="flex min-w-0 flex-col gap-2 empty:hidden"
                >
                    {failure !== null && !searching && (
                        <p className="text-sm text-skrum-destructive-text">
                            {integrationErrorMessage(
                                failure.error,
                                t('Something went wrong.'),
                            )}
                        </p>
                    )}
                    {searching && <Spinner aria-label={t('Loading')} />}
                    {searchable &&
                        !searching &&
                        failure === null &&
                        results.length === 0 && (
                            <p className="text-sm text-muted-foreground">
                                {t('No account found.')}
                            </p>
                        )}
                    {searchable && !searching && results.length > 0 && (
                        <ul className="flex max-h-64 min-w-0 flex-col gap-0.5 overflow-y-auto">
                            {results.map((account) => (
                                <li key={account.accountId} className="p-0.5">
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        className="w-full justify-start"
                                        onClick={() =>
                                            onChoose(account.accountId)
                                        }
                                    >
                                        <span className="truncate">
                                            {account.displayName}
                                        </span>
                                    </Button>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
