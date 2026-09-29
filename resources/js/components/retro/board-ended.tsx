import { Link } from '@inertiajs/react';
import { Button } from '@/components/ui/button';
import { useTrans } from '@/hooks/use-trans';

export function BoardEnded({
    reason,
    teamUrl,
}: {
    reason: 'ended' | 'deleted';
    teamUrl: string | null;
}) {
    const { t } = useTrans();

    return (
        <div className="flex min-h-dvh flex-col items-center justify-center gap-4 p-6 text-center">
            <p className="text-lg">
                {reason === 'deleted'
                    ? t('This retrospective has been deleted.')
                    : t('Your access to this retrospective has ended.')}
            </p>
            {teamUrl && (
                <Button asChild variant="outline">
                    <Link href={teamUrl}>{t('Back to the team')}</Link>
                </Button>
            )}
        </div>
    );
}
