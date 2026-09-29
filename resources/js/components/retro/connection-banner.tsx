import { useTrans } from '@/hooks/use-trans';

export function ConnectionBanner({ connected }: { connected: boolean }) {
    const { t } = useTrans();

    if (connected) {
        return null;
    }

    return (
        <div
            role="status"
            className="bg-amber-100 px-4 py-1 text-center text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-100"
        >
            {t('Reconnecting…')}
        </div>
    );
}
