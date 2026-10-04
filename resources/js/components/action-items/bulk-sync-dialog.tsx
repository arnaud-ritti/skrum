import { useState } from 'react';
import {
    EmptyExportTarget,
    ExportTargetFields,
} from '@/components/action-items/export-target-fields';
import type {
    ExportTarget,
    IntegrationScope,
} from '@/components/action-items/export-target-fields';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { useRestoreFocus } from '@/components/ui/use-restore-focus';
import { useTrans } from '@/hooks/use-trans';
import type { ExportSource } from '@/types/integrations';

type Props = {
    source: ExportSource;
    scope: IntegrationScope;
    /** The one team of the selection, whose tracker settings apply. */
    teamId: string;
    /** The selected items not linked to that tracker yet. */
    count: number;
    onCancel: () => void;
    onConfirm: (target: ExportTarget) => void;
};

/** The target of "Sync to :tracker", chosen once for the whole selection. */
export function BulkSyncDialog({
    source,
    scope,
    teamId,
    count,
    onCancel,
    onConfirm,
}: Props) {
    const { t } = useTrans();
    const restoreFocus = useRestoreFocus(true);
    const [target, setTarget] = useState<ExportTarget>(EmptyExportTarget);
    const [ready, setReady] = useState(false);

    return (
        <Dialog
            open
            onOpenChange={(open) => {
                if (!open) {
                    onCancel();
                }
            }}
        >
            <DialogContent
                data-slot="bulk-sync-dialog"
                onCloseAutoFocus={restoreFocus}
            >
                <DialogHeader>
                    <DialogTitle>
                        {t('Sync to :tracker', { tracker: source.label })}
                    </DialogTitle>
                    <DialogDescription>
                        {t(
                            'Creates one issue per action item, with a link back to skrum. Later changes are not synced.',
                        )}
                    </DialogDescription>
                </DialogHeader>
                <ExportTargetFields
                    source={source}
                    scope={scope}
                    teamId={teamId}
                    value={target}
                    onChange={setTarget}
                    onReadyChange={setReady}
                />
                <DialogFooter>
                    <Button type="button" variant="outline" onClick={onCancel}>
                        <span className="truncate">{t('Cancel')}</span>
                    </Button>
                    <Button
                        type="button"
                        disabled={!ready || count === 0}
                        onClick={() => onConfirm(target)}
                    >
                        <span className="truncate">
                            {count === 1
                                ? t('Export 1 item')
                                : t('Export :count items', { count })}
                        </span>
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
