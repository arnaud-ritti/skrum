import { Head } from '@inertiajs/react';
import { Board } from '@/components/retro/board';
import type { Snapshot } from '@/lib/retro/types';

export default function ShowRetro({ snapshot }: { snapshot: Snapshot }) {
    return (
        <>
            <Head title={snapshot.retro.title} />
            <Board snapshot={snapshot} />
        </>
    );
}
