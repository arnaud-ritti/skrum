import { Head, router } from '@inertiajs/react';
import { ActionItemSearchField } from '@/components/action-items/action-item-search-field';
import { SessionsPage } from '@/components/teams/sessions-page';
import type { SessionsPageProps } from '@/components/teams/sessions-page';
import { useTrans } from '@/hooks/use-trans';
import AppLayout from '@/layouts/skrum/app-layout';
import { sessionsHref } from '@/lib/teams/sessions';

export default function TeamSessions(props: SessionsPageProps) {
    const { t } = useTrans();
    const { workspace, team, kind, q } = props;
    const search = (term: string | null): void =>
        router.get(
            sessionsHref(workspace.slug, team.id, { kind, q: term }),
            {},
            { preserveState: true, preserveScroll: true, replace: true },
        );

    return (
        <AppLayout
            active="sessions"
            title={t('Sessions')}
            search={
                <ActionItemSearchField
                    value={q}
                    onSearch={search}
                    label={t('Search sessions')}
                    placeholder={t('Search sessions')}
                    className="hidden w-64 md:flex"
                />
            }
        >
            <Head title={t('Sessions')} />
            <SessionsPage {...props} />
        </AppLayout>
    );
}
