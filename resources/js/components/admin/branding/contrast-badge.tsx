import { Check, TriangleAlert } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useTrans } from '@/hooks/use-trans';
import { contrastLevel, formatRatio } from './branding';

export function ContrastBadge({
    ratio,
    className,
}: {
    ratio: number;
    className?: string;
}) {
    const { t } = useTrans();
    const level = contrastLevel(ratio);
    const label = level === 'below' ? t('Below AA') : level;

    return (
        <Badge
            data-slot="contrast-badge"
            data-level={level}
            variant={level === 'below' ? 'warning' : 'success'}
            icon={level === 'below' ? TriangleAlert : Check}
            className={className}
        >
            <span className="truncate tabular-nums">
                {`${label} ${formatRatio(ratio)}:1`}
            </span>
        </Badge>
    );
}
