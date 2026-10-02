import { Head } from '@inertiajs/react';
import TeamsController from '@/actions/App/Http/Controllers/TeamsController';
import { SavedDecksPage } from '@/components/poker/saved-decks-page';
import type { SavedDecksPageProps } from '@/components/poker/saved-decks-page';
import { useTrans } from '@/hooks/use-trans';
import AppLayout from '@/layouts/skrum/app-layout';
import { index } from '@/routes/teams/pokerDecks';

export default function PokerDecks(props: SavedDecksPageProps) {
    const { t } = useTrans();
    const params = { workspace: props.workspace.slug, team: props.team.id };

    return (
        <AppLayout
            active="sessions"
            breadcrumbs={[
                { title: props.team.name, href: TeamsController.show(params) },
                { title: t('Saved decks'), href: index(params) },
            ]}
        >
            <Head title={t('Saved decks')} />
            <SavedDecksPage {...props} />
        </AppLayout>
    );
}
