import { Link } from '@inertiajs/react';
import { Button } from '@/components/ui/button';
import { useTrans } from '@/hooks/use-trans';

type Props = {
    reason: 'ended' | 'deleted';
    teamUrl: string | null;
};

export function RoomGone({ reason, teamUrl }: Props) {
    const { t } = useTrans();

    return (
        <div className="flex min-h-dvh flex-col items-center justify-center gap-4 p-6 text-center">
            <p className="text-lg">
                {reason === 'deleted'
                    ? t('This room was deleted.')
                    : t('Your access to this room has ended.')}
            </p>
            {teamUrl && (
                <Button asChild variant="outline">
                    <Link href={teamUrl}>{t('Back to the team')}</Link>
                </Button>
            )}
        </div>
    );
}
