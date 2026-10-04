import {
    CircleAlert,
    ImageOff,
    Trash2,
    TriangleAlert,
    Undo2,
    Upload,
} from 'lucide-react';
import { useId, useRef, useState } from 'react';
import type { ChangeEvent, DragEvent } from 'react';
import { ConfirmDialog } from '@/components/skrum/confirm-dialog';
import { LoadingButton } from '@/components/skrum/loading-button';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useTrans } from '@/hooks/use-trans';
import { cn } from '@/lib/utils';
import { AssetAccept, assetRejection } from './branding';
import type { AssetRejection, ThemeName } from './branding';

type AssetUploaderProps = {
    label: string;
    description?: string;
    /** Replaces the line about the accepted formats. */
    hint?: string;
    /** What the missing image costs, shown until one is stored. */
    warning?: string;
    /** Image to show, always through `<img>`: the stored one or a staged file. */
    url: string | null;
    /** Name of the staged file; absent for the stored image. */
    fileName?: string;
    /** The image shown, or its absence, waits for Save. */
    staged?: boolean;
    /** Theme of the surface the image is meant for. */
    surface?: ThemeName;
    busy?: boolean;
    /** No file is taken while the form saves. */
    disabled?: boolean;
    /** What is shown once the image is removed. */
    fallback?: string;
    /** Server refusal of the last upload. */
    error?: string;
    onUpload: (file: File) => void;
    /** Removal of the stored image, confirmed first. */
    onRemove: () => Promise<void> | void;
    /** Takes back the staged file or the staged removal of this image alone. */
    onUndo?: () => void;
    className?: string;
};

export function AssetUploader({
    label,
    description,
    hint,
    warning,
    url,
    fileName,
    staged = false,
    surface = 'light',
    busy = false,
    disabled = false,
    fallback,
    error,
    onUpload,
    onRemove,
    onUndo,
    className,
}: AssetUploaderProps) {
    const { t } = useTrans();
    const id = useId();
    const inputRef = useRef<HTMLInputElement>(null);
    const uploadRef = useRef<HTMLButtonElement>(null);
    const [rejection, setRejection] = useState<AssetRejection | null>(null);
    const [confirming, setConfirming] = useState(false);
    const [dragging, setDragging] = useState(false);
    const rejectionMessages: Record<AssetRejection, string> = {
        size: t('This file is larger than 512 KB.'),
        type: t('Use a PNG, JPEG, WebP or SVG image.'),
    };
    const message = rejection === null ? error : rejectionMessages[rejection];
    const emptyName = url === null ? t('No image') : t('Current image');

    const locked = busy || disabled;

    function accept(file: File | undefined): void {
        if (file === undefined || locked) {
            return;
        }

        const refused = assetRejection(file);

        setRejection(refused);

        if (refused !== null) {
            return;
        }

        onUpload(file);
    }

    function handleFile(event: ChangeEvent<HTMLInputElement>): void {
        const file = event.target.files?.[0];

        event.target.value = '';
        accept(file);
    }

    function handleDrop(event: DragEvent<HTMLDivElement>): void {
        event.preventDefault();
        setDragging(false);
        accept(event.dataTransfer.files[0]);
    }

    function handleDragOver(event: DragEvent<HTMLDivElement>): void {
        event.preventDefault();
        setDragging(!locked);
    }

    /** Moving over a child of the zone is not leaving it. */
    function handleDragLeave(event: DragEvent<HTMLDivElement>): void {
        if (event.currentTarget.contains(event.relatedTarget as Node | null)) {
            return;
        }

        setDragging(false);
    }

    /** The button leaves with the staged change: the focus goes to its neighbour. */
    function undo(): void {
        setRejection(null);
        onUndo?.();
        uploadRef.current?.focus();
    }

    return (
        <div
            data-slot="asset-uploader"
            className={cn('@container flex min-w-0 flex-col gap-2', className)}
        >
            <div
                data-slot="asset-drop-zone"
                data-dragging={dragging ? '' : undefined}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                aria-disabled={locked || undefined}
                className="flex min-w-0 flex-wrap items-center gap-4 rounded-lg border-2 border-dashed border-input p-4 transition-colors duration-140 ease-standard data-[dragging]:border-primary data-[dragging]:bg-skrum-primary-soft motion-reduce:transition-none"
            >
                <div className={cn('flex shrink-0', surface)}>
                    <div
                        data-slot="asset-preview"
                        className="flex size-14 items-center justify-center overflow-hidden rounded-lg border bg-background p-1.5 text-muted-foreground"
                    >
                        {url === null ? (
                            <ImageOff aria-hidden="true" className="size-5" />
                        ) : (
                            <img
                                src={url}
                                alt=""
                                className="max-h-full max-w-full object-contain"
                            />
                        )}
                    </div>
                </div>
                <div className="flex min-w-0 flex-1 basis-40 flex-col gap-0.5">
                    <span className="flex min-w-0 items-center gap-2">
                        <span
                            id={`${id}-label`}
                            className="sr-only"
                        >{`${label}: `}</span>
                        <span
                            data-slot="asset-name"
                            className="truncate text-sm font-semibold"
                        >
                            {fileName ?? emptyName}
                        </span>
                        {staged && (
                            <Badge
                                variant="soft"
                                data-slot="asset-staged"
                                className="shrink-0"
                            >
                                {t('Not saved')}
                            </Badge>
                        )}
                    </span>
                    {description && (
                        <span className="text-xs text-muted-foreground">
                            {description}
                        </span>
                    )}
                    <span
                        id={`${id}-hint`}
                        className="text-xs text-muted-foreground"
                    >
                        {hint ?? t('PNG, JPEG, WebP or SVG, 512 KB at most.')}
                    </span>
                </div>
                <input
                    ref={inputRef}
                    type="file"
                    accept={AssetAccept}
                    aria-labelledby={`${id}-label`}
                    aria-describedby={`${id}-hint`}
                    onChange={handleFile}
                    disabled={locked}
                    tabIndex={-1}
                    className="sr-only"
                />
                <div className="flex min-w-0 flex-wrap gap-2">
                    <LoadingButton
                        ref={uploadRef}
                        type="button"
                        variant="outline"
                        size="sm"
                        loading={busy}
                        disabled={disabled}
                        onClick={() => inputRef.current?.click()}
                        className="max-w-full min-w-0"
                    >
                        <Upload aria-hidden="true" />
                        <span className="truncate">
                            {url === null ? t('Upload') : t('Replace')}
                        </span>
                    </LoadingButton>
                    {staged && onUndo && (
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            disabled={locked}
                            data-slot="asset-undo"
                            onClick={undo}
                            className="max-w-full min-w-0"
                        >
                            <Undo2 aria-hidden="true" />
                            <span className="truncate">{t('Undo')}</span>
                        </Button>
                    )}
                    {url !== null && fileName === undefined && (
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            disabled={locked}
                            onClick={() => setConfirming(true)}
                            className="max-w-full min-w-0 text-skrum-destructive-text"
                        >
                            <Trash2 aria-hidden="true" />
                            <span className="truncate">{t('Remove')}</span>
                        </Button>
                    )}
                </div>
            </div>
            {warning && (
                <p
                    data-slot="asset-warning"
                    className="flex items-start gap-1.5 text-body-sm text-skrum-warning-text"
                >
                    <TriangleAlert
                        aria-hidden="true"
                        className="mt-0.5 size-4 shrink-0"
                    />
                    <span className="min-w-0">{warning}</span>
                </p>
            )}
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
                description={[
                    t(':name is removed when you save.', { name: label }),
                    fallback,
                ]
                    .filter(Boolean)
                    .join(' ')}
                confirmLabel={t('Remove')}
                onConfirm={async () => {
                    await onRemove();
                }}
            />
        </div>
    );
}
