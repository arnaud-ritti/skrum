import { router } from '@inertiajs/react';
import { ShieldPlus } from 'lucide-react';
import { useEffect, useState } from 'react';
import AdminCandidatesController from '@/actions/App/Http/Controllers/Admin/AdminCandidatesController';
import AdminsController from '@/actions/App/Http/Controllers/Admin/AdminsController';
import { AdminsList } from '@/components/admin/admins/admins-list';
import { CandidateCombobox } from '@/components/admin/admins/candidate-combobox';
import { RevokeAdminDialog } from '@/components/admin/admins/revoke-admin-dialog';
import { CandidateQueryMinLength } from '@/components/admin/admins/types';
import type {
    AdminCandidate,
    CandidateSearchStatus,
    InstanceAdmin,
} from '@/components/admin/admins/types';
import { LoadingButton } from '@/components/skrum/loading-button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { useTrans } from '@/hooks/use-trans';
import { retroRequest, RetroRequestError } from '@/lib/retro/api';

const CandidateSearchDelayMs = 300;

const PasswordConfirmationExpired = 423;

type SearchResult = {
    query: string;
    candidates: AdminCandidate[];
    failed: boolean;
};

function useCandidateSearch(query: string) {
    const trimmed = query.trim();
    const [result, setResult] = useState<SearchResult | null>(null);
    const searchable = trimmed.length >= CandidateQueryMinLength;

    useEffect(() => {
        if (!searchable) {
            return;
        }

        let stale = false;

        const timer = setTimeout(() => {
            retroRequest<{ candidates: AdminCandidate[] }>(
                AdminCandidatesController.index({ query: { query: trimmed } }),
            )
                .then((response) => {
                    if (!stale) {
                        setResult({
                            query: trimmed,
                            candidates: response.candidates,
                            failed: false,
                        });
                    }
                })
                .catch((error: unknown) => {
                    if (
                        error instanceof RetroRequestError &&
                        error.status === PasswordConfirmationExpired
                    ) {
                        // The page itself needs a confirmed password: reloading
                        // it lets the server send the admin to the confirmation
                        // screen and back here afterwards.
                        router.reload();

                        return;
                    }

                    if (!stale) {
                        setResult({
                            query: trimmed,
                            candidates: [],
                            failed: true,
                        });
                    }
                });
        }, CandidateSearchDelayMs);

        return () => {
            stale = true;
            clearTimeout(timer);
        };
    }, [searchable, trimmed]);

    const current = searchable && result?.query === trimmed ? result : null;

    const statuses: Record<string, CandidateSearchStatus> = {
        idle: 'idle',
        pending: 'loading',
        failed: 'error',
        done: 'ready',
    };

    const state = !searchable
        ? 'idle'
        : current === null
          ? 'pending'
          : current.failed
            ? 'failed'
            : 'done';

    return {
        status: statuses[state],
        candidates: current?.candidates ?? [],
        forget: () => setResult(null),
    };
}

export function AdminsPanel({ admins }: { admins: InstanceAdmin[] }) {
    const { t } = useTrans();
    const [query, setQuery] = useState('');
    const [candidate, setCandidate] = useState<AdminCandidate | null>(null);
    const [granting, setGranting] = useState(false);
    const [grantError, setGrantError] = useState<string>();
    const [target, setTarget] = useState<InstanceAdmin | null>(null);
    const [revokeOpen, setRevokeOpen] = useState(false);
    const [revokeError, setRevokeError] = useState<string>();
    const search = useCandidateSearch(query);

    const grant = (): void => {
        if (candidate === null) {
            return;
        }

        setGrantError(undefined);

        router.post(
            AdminsController.store.url(),
            { user_id: candidate.id },
            {
                preserveScroll: true,
                onStart: () => setGranting(true),
                onFinish: () => setGranting(false),
                onSuccess: () => {
                    setCandidate(null);
                    setQuery('');
                    search.forget();
                },
                onError: (errors) =>
                    setGrantError(
                        errors.user_id ??
                            t('Something went wrong. Please try again.'),
                    ),
            },
        );
    };

    const askRevoke = (admin: InstanceAdmin): void => {
        setRevokeError(undefined);
        setTarget(admin);
        setRevokeOpen(true);
    };

    const revoke = (): Promise<void> => {
        if (target === null) {
            return Promise.resolve();
        }

        setRevokeError(undefined);

        return new Promise<void>((resolve, reject) => {
            let revoked = false;
            let refusal: string | undefined;

            router.delete(AdminsController.destroy.url(target.id), {
                preserveScroll: true,
                onSuccess: () => {
                    revoked = true;
                },
                onError: (errors) => {
                    refusal = errors.user;
                },
                onFinish: () => {
                    if (revoked) {
                        resolve();

                        return;
                    }

                    setRevokeError(
                        refusal ?? t('Something went wrong. Please try again.'),
                    );
                    reject(new Error('revocation refused'));
                },
            });
        });
    };

    return (
        <div data-slot="admins-panel" className="flex min-w-0 flex-col gap-6">
            <Card>
                <CardHeader>
                    <CardTitle>{t('Add an admin')}</CardTitle>
                    <CardDescription>
                        {t(
                            'An instance admin manages the branding and the other admins of this instance.',
                        )}
                    </CardDescription>
                </CardHeader>
                <CardContent className="@container/action">
                    <div className="grid min-w-0 gap-3 @action-stack/action:grid-cols-[minmax(0,1fr)_auto] @action-stack/action:items-start">
                        <CandidateCombobox
                            label={t('Member')}
                            query={query}
                            onQueryChange={setQuery}
                            candidates={search.candidates}
                            status={search.status}
                            value={candidate}
                            onValueChange={(next) => {
                                setGrantError(undefined);
                                setCandidate(next);
                            }}
                            error={grantError}
                            disabled={granting}
                        />
                        <LoadingButton
                            type="button"
                            loading={granting}
                            disabled={candidate === null}
                            onClick={grant}
                            className="max-w-full @action-stack/action:mt-5"
                        >
                            <ShieldPlus aria-hidden="true" />
                            <span className="truncate">
                                {t('Grant admin rights')}
                            </span>
                        </LoadingButton>
                    </div>
                </CardContent>
            </Card>
            <Card>
                <CardHeader>
                    <CardTitle>{t('Instance admins')}</CardTitle>
                    <CardDescription>
                        {t('An instance needs at least one admin.')}
                    </CardDescription>
                </CardHeader>
                <AdminsList
                    admins={admins}
                    onRevoke={askRevoke}
                    className="mt-3 border-t"
                />
            </Card>
            <RevokeAdminDialog
                admin={target}
                open={revokeOpen}
                onOpenChange={(open) => {
                    setRevokeOpen(open);

                    if (!open) {
                        setRevokeError(undefined);
                    }
                }}
                onConfirm={revoke}
                error={revokeError}
            />
        </div>
    );
}
