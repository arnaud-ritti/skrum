import { Button } from '@/components/ui/button';
import { useTrans } from '@/hooks/use-trans';

export function SessionExpiredBanner() {
    const { t } = useTrans();

    return (
        <div
            role="alert"
            className="flex items-center justify-center gap-3 bg-destructive px-4 py-2 text-sm text-white"
        >
            <span>{t('Your session has expired.')}</span>
            <Button
                size="sm"
                variant="secondary"
                onClick={() => window.location.reload()}
            >
                {t('Reload')}
            </Button>
        </div>
    );
}
