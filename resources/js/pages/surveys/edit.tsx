import { Head } from '@inertiajs/react';

type Props = { snapshot: { survey: { title: string } } };

export default function SurveyBuilder({ snapshot }: Props) {
    return (
        <>
            <Head title={snapshot.survey.title} />
            <main className="p-6">
                <h1 className="text-lg font-semibold text-foreground">
                    {snapshot.survey.title}
                </h1>
            </main>
        </>
    );
}
