import { FileDown } from 'lucide-react';
import type { ActionItemFilters } from '@/components/action-items/use-action-item-filters';
import { Button } from '@/components/ui/button';
import { useTrans } from '@/hooks/use-trans';
import { actionItemsExportUrl } from '@/lib/action-items/bulk';

type Props = {
    workspace: string;
    filters: ActionItemFilters;
};

/** The CSV of every item matching the filters, all pages (spec 24 §9.1). */
export function ExportActionItemsButton({ workspace, filters }: Props) {
    const { t } = useTrans();

    return (
        <Button
            asChild
            variant="outline"
            data-slot="export-action-items"
            className="shrink-0"
        >
            <a href={actionItemsExportUrl(workspace, filters)} download>
                <FileDown aria-hidden />
                <span className="max-sm:sr-only">{t('Export')}</span>
            </a>
        </Button>
    );
}
