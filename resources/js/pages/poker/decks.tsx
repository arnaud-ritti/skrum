import { Head } from '@inertiajs/react';
import { SavedDecksPage } from '@/components/poker/saved-decks-page';
import type { SavedDecksPageProps } from '@/components/poker/saved-decks-page';
import { useTrans } from '@/hooks/use-trans';
import AppLayout from '@/layouts/skrum/app-layout';

export default function PokerDecks(props: SavedDecksPageProps) {
    const { t } = useTrans();
    return (
        <AppLayout active="sessions" title={t('Saved decks')}>
            <Head title={t('Saved decks')} />
            <SavedDecksPage {...props} />
        </AppLayout>
    );
}
