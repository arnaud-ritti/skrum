import { Head } from '@inertiajs/react';

type Props = { isInvalid: true } | { isInvalid: false; surveyTitle: string };

export default function JoinSurvey(props: Props) {
    const title = props.isInvalid ? '' : props.surveyTitle;

    return (
        <>
            <Head title={title} />
            <main className="p-6">
                {props.isInvalid ? null : (
                    <h1 className="text-lg font-semibold text-foreground">
                        {props.surveyTitle}
                    </h1>
                )}
            </main>
        </>
    );
}
