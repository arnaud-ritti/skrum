import { Head } from '@inertiajs/react';
import type { WhiteboardSnapshot } from '@/lib/whiteboard/types';

type Props = { snapshot: WhiteboardSnapshot };

export default function ShowWhiteboard({ snapshot }: Props) {
    return <Head title={snapshot.board.title} />;
}
