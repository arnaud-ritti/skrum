import { Head } from '@inertiajs/react';

type Props = { snapshot: { game: { title: string } } };

export default function ShowPokerGame({ snapshot }: Props) {
    return <Head title={snapshot.game.title} />;
}
