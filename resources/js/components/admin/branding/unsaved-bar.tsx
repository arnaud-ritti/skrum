import { LoadingButton } from '@/components/skrum/loading-button';
import { Button } from '@/components/ui/button';
import { useTrans } from '@/hooks/use-trans';
import { cn } from '@/lib/utils';

type UnsavedBarProps = {
    count: number;
    saving?: boolean;
    onCancel: () => void;
    /** Id of the form that "Save" submits: the bar sits in the topbar, outside it. */
    form?: string;
    className?: string;
};

export function UnsavedBar({
    count,
    saving = false,
    onCancel,
    form,
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
                'flex min-w-0 shrink-0 items-center gap-2',
                className,
            )}
        >
            <p
                role="status"
                data-dirty={dirty ? '' : undefined}
                className="sr-only truncate text-xs text-muted-foreground data-[dirty]:font-semibold data-[dirty]:text-skrum-primary-text md:data-[dirty]:not-sr-only"
            >
                {message}
            </p>
            <Button
                type="button"
                variant="ghost"
                disabled={!dirty || saving}
                onClick={onCancel}
                className="max-w-full min-w-0"
            >
                <span className="truncate">{t('Cancel')}</span>
            </Button>
            <LoadingButton
                type="submit"
                form={form}
                loading={saving}
                disabled={!dirty}
                className="max-w-full min-w-0"
            >
                <span className="truncate">{t('Save')}</span>
            </LoadingButton>
        </div>
    );
}
