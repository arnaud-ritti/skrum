import { Head } from '@inertiajs/react';
import Heading from '@/components/heading';
import { useTrans } from '@/hooks/use-trans';

type Props = {
    snapshot: {
        retro: { id: string; title: string; phase: string };
    };
};

export default function ShowRetro({ snapshot }: Props) {
    const { t } = useTrans();

    return (
        <>
            <Head title={snapshot.retro.title} />
            <div className="mx-auto max-w-3xl p-6">
                <Heading
                    title={snapshot.retro.title}
                    description={t('The board is being built.')}
                />
            </div>
        </>
    );
}
