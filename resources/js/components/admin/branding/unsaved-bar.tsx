import { Save } from 'lucide-react';
import { LoadingButton } from '@/components/skrum/loading-button';
import { Button } from '@/components/ui/button';
import { useTrans } from '@/hooks/use-trans';
import { cn } from '@/lib/utils';

export type UnsavedBarProps = {
    count: number;
    saving?: boolean;
    onCancel: () => void;
    className?: string;
};

/** Sits inside the form it saves: "Save" is its submit button. */
export function UnsavedBar({
    count,
    saving = false,
    onCancel,
    className,
}: UnsavedBarProps) {
    const { t } = useTrans();
    const dirty = count > 0;
    const pluralMessage = dirty
        ? t(':count unsaved changes', { count })
        : t('No unsaved changes');
    const message = count === 1 ? t('1 unsaved change') : pluralMessage;

    return (
        <div
            data-slot="unsaved-bar"
            data-dirty={dirty ? '' : undefined}
            className={cn(
                'flex min-w-0 flex-wrap items-center gap-2 rounded-lg border bg-card p-3 shadow-card data-[dirty]:border-primary',
                className,
            )}
        >
            <p
                role="status"
                className="min-w-0 flex-1 basis-40 truncate text-sm font-medium data-[dirty]:text-skrum-primary-text"
                data-dirty={dirty ? '' : undefined}
            >
                {message}
            </p>
            <Button
                type="button"
                variant="outline"
                disabled={!dirty || saving}
                onClick={onCancel}
                className="max-w-full min-w-0"
            >
                <span className="truncate">{t('Cancel')}</span>
            </Button>
            <LoadingButton
                type="submit"
                loading={saving}
                disabled={!dirty}
                className="max-w-full min-w-0"
            >
                <Save aria-hidden="true" />
                <span className="truncate">{t('Save')}</span>
            </LoadingButton>
        </div>
    );
}
