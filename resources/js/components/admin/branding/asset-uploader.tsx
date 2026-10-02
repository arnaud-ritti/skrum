import { CircleAlert, ImageOff, Trash2, Upload } from 'lucide-react';
import { useId, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { ConfirmDialog } from '@/components/skrum/confirm-dialog';
import { LoadingButton } from '@/components/skrum/loading-button';
import { Button } from '@/components/ui/button';
import { useTrans } from '@/hooks/use-trans';
import { cn } from '@/lib/utils';
import { AssetAccept, assetRejection } from './branding';
import type { AssetRejection, ThemeName } from './branding';

export type AssetUploaderProps = {
    label: string;
    description?: string;
    /** Current image, always shown through `<img>`. */
    url: string | null;
    /** Theme of the surface the image is meant for. */
    surface?: ThemeName;
    busy?: boolean;
    /** Server refusal of the last upload. */
    error?: string;
    onUpload: (file: File) => void;
    onRemove: () => Promise<void>;
    className?: string;
};

export function AssetUploader({
    label,
    description,
    url,
    surface = 'light',
    busy = false,
    error,
    onUpload,
    onRemove,
    className,
}: AssetUploaderProps) {
    const { t } = useTrans();
    const id = useId();
    const inputRef = useRef<HTMLInputElement>(null);
    const [rejection, setRejection] = useState<AssetRejection | null>(null);
    const [confirming, setConfirming] = useState(false);
    const rejectionMessages: Record<AssetRejection, string> = {
        size: t('This file is larger than 512 KB.'),
        type: t('Use a PNG, JPEG, WebP or SVG image.'),
    };
    const message = rejection === null ? error : rejectionMessages[rejection];

    function handleFile(event: ChangeEvent<HTMLInputElement>): void {
        const file = event.target.files?.[0];

        event.target.value = '';

        if (file === undefined) {
            return;
        }

        const refused = assetRejection(file);

        setRejection(refused);

        if (refused !== null) {
            return;
        }

        onUpload(file);
    }

    return (
        <div
            data-slot="asset-uploader"
            className={cn(
                'flex min-w-0 flex-col gap-3 rounded-lg border bg-card p-3',
                className,
            )}
        >
            <div className="flex min-w-0 flex-col gap-0.5">
                <span
                    id={`${id}-label`}
                    className="truncate text-sm font-semibold"
                >
                    {label}
                </span>
                {description && (
                    <span className="text-body-sm text-muted-foreground">
                        {description}
                    </span>
                )}
            </div>
            <div className={cn('flex', surface)}>
                <div
                    data-slot="asset-preview"
                    className="flex h-20 w-full min-w-0 items-center justify-center rounded-md border bg-background p-3 text-muted-foreground"
                >
                    {url === null ? (
                        <span className="flex min-w-0 items-center gap-2 text-body-sm">
                            <ImageOff
                                aria-hidden="true"
                                className="size-4 shrink-0"
                            />
                            <span className="truncate">{t('No image')}</span>
                        </span>
                    ) : (
                        <img
                            src={url}
                            alt={t('Current image: :name', { name: label })}
                            className="max-h-full max-w-full object-contain"
                        />
                    )}
                </div>
            </div>
            <p id={`${id}-hint`} className="text-xs text-muted-foreground">
                {t('PNG, JPEG, WebP or SVG, 512 KB at most.')}
            </p>
            <input
                ref={inputRef}
                type="file"
                accept={AssetAccept}
                aria-labelledby={`${id}-label`}
                aria-describedby={`${id}-hint`}
                onChange={handleFile}
                tabIndex={-1}
                className="sr-only"
            />
            <div className="flex min-w-0 flex-wrap gap-2">
                <LoadingButton
                    type="button"
                    variant="outline"
                    size="sm"
                    loading={busy}
                    onClick={() => inputRef.current?.click()}
                    className="max-w-full min-w-0"
                >
                    <Upload aria-hidden="true" />
                    <span className="truncate">
                        {url === null ? t('Upload') : t('Replace')}
                    </span>
                </LoadingButton>
                {url !== null && (
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={busy}
                        onClick={() => setConfirming(true)}
                        className="max-w-full min-w-0 text-skrum-destructive-text"
                    >
                        <Trash2 aria-hidden="true" />
                        <span className="truncate">{t('Remove')}</span>
                    </Button>
                )}
            </div>
            {message && (
                <p
                    role="alert"
                    data-slot="asset-error"
                    className="flex items-start gap-1.5 text-body-sm text-skrum-destructive-text"
                >
                    <CircleAlert
                        aria-hidden="true"
                        className="mt-0.5 size-4 shrink-0"
                    />
                    <span className="min-w-0">{message}</span>
                </p>
            )}
            <ConfirmDialog
                open={confirming}
                onOpenChange={setConfirming}
                tone="destructive"
                title={t('Remove this image?')}
                description={t(
                    ':name is removed for everyone. The Skrüm image is shown again.',
                    { name: label },
                )}
                confirmLabel={t('Remove')}
                onConfirm={onRemove}
            />
        </div>
    );
}
