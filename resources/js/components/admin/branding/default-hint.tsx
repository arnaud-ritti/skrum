import { Badge } from '@/components/ui/badge';
import { useTrans } from '@/hooks/use-trans';

/** Marks a field that shows the default because nothing is stored for it. */
export function DefaultHint({ className }: { className?: string }) {
    const { t } = useTrans();

    return (
        <Badge variant="muted" data-slot="default-hint" className={className}>
            {t('Default')}
        </Badge>
    );
}
