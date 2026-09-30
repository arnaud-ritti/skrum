import { Info } from 'lucide-react';
import { useTrans } from '@/hooks/use-trans';

export function AnonymousNotice() {
    const { t } = useTrans();

    return (
        <p className="flex items-center gap-1 text-xs text-muted-foreground">
            <Info className="size-3 shrink-0" aria-hidden="true" />
            {t('Action items are not anonymous: your name is shown.')}
        </p>
    );
}
