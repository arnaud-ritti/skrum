import { Download, FileJson, Image } from 'lucide-react';
import { useEffect, useId, useState } from 'react';
import { DialogError } from '@/components/skrum/confirm-dialog';
import { LoadingButton } from '@/components/skrum/loading-button';
import { SettingRow } from '@/components/teams/session-create/setting-row';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { ToggleGroup } from '@/components/ui/toggle-group';
import { useRestoreFocus } from '@/components/ui/use-restore-focus';
import { useTrans } from '@/hooks/use-trans';
import {
    exportImage,
    hasDrawing,
    imageFileName,
    type ImageFormat,
} from '@/lib/whiteboard/export-image';
import {
    saveBoardData,
    saveFile,
    type BoardScene,
} from '@/lib/whiteboard/save-file';

type FormProps = {
    /** The board's title: the saved file is named after it. */
    title: string;
    /** The canvas as it is when called: the dialog keeps no copy of it. */
    getScene: () => BoardScene;
    /** Something is selected on the board: "Only the selection" is offered. */
    hasSelection: boolean;
};

type Props = FormProps & {
    open: boolean;
    onOpenChange: (open: boolean) => void;
};

type Size = '1' | '2' | '3';

type Preview = { of: string; url: string | null };

function ExportForm({
    title,
    getScene,
    hasSelection,
    onClose,
}: FormProps & { onClose: () => void }) {
    const { t } = useTrans();
    const id = useId();
    const [what, setWhat] = useState<'image' | 'data'>('image');
    const [format, setFormat] = useState<ImageFormat>('png');
    const [background, setBackground] = useState(true);
    const [size, setSize] = useState<Size>('1');
    const [selectionOnly, setSelectionOnly] = useState(false);
    const [empty] = useState(() => !hasDrawing(getScene()));
    const [preview, setPreview] = useState<Preview | null>(null);
    const [saving, setSaving] = useState(false);
    const [failed, setFailed] = useState(false);
    const drawsImage = what === 'image' && !empty;
    const previewed = `${format}:${background}:${selectionOnly}`;
    const shown = preview?.of === previewed ? preview : null;

    useEffect(() => {
        if (!drawsImage) {
            return;
        }

        let url: string | null = null;
        let stale = false;

        // ponytail: the preview is drawn at the board's full 1× size and scaled by the browser; cap it with the library's `maxWidthOrHeight` if a very large board makes it slow.
        exportImage(getScene(), {
            format,
            background,
            scale: 1,
            selectionOnly,
        })
            .then((blob) => {
                if (stale) {
                    return;
                }

                url = URL.createObjectURL(blob);
                setPreview({ of: previewed, url });
            })
            .catch(() => {
                if (!stale) {
                    setPreview({ of: previewed, url: null });
                }
            });

        return () => {
            stale = true;

            if (url !== null) {
                URL.revokeObjectURL(url);
            }
        };
    }, [drawsImage, format, background, selectionOnly, getScene, previewed]);

    const download = async (): Promise<void> => {
        setFailed(false);
        setSaving(true);

        try {
            const scene = getScene();

            if (what === 'data') {
                saveBoardData(title, scene);
            } else {
                saveFile(
                    await exportImage(scene, {
                        format,
                        background,
                        scale: Number(size) as 1 | 2 | 3,
                        selectionOnly,
                    }),
                    imageFileName(title, format),
                );
            }

            onClose();
        } catch {
            setFailed(true);
        } finally {
            setSaving(false);
        }
    };

    return (
        <>
            <div className="flex min-w-0 flex-col gap-4 px-5 py-4">
                <div className="flex min-w-0 flex-col items-start gap-1.5">
                    <span aria-hidden className="text-body-sm font-medium">
                        {t('What')}
                    </span>
                    <ToggleGroup
                        type="single"
                        variant="segmented"
                        aria-label={t('What')}
                        value={what}
                        onValueChange={setWhat}
                        options={[
                            { value: 'image', label: t('Image'), icon: Image },
                            {
                                value: 'data',
                                label: t('Board data'),
                                icon: FileJson,
                            },
                        ]}
                    />
                </div>
                {what === 'data' && (
                    <p className="text-body-sm text-muted-foreground">
                        {t(
                            'Everything on the board, as a data file to open again.',
                        )}
                    </p>
                )}
                {what === 'image' && (
                    <div className="grid min-w-0 gap-4 md:grid-cols-2">
                        <div className="min-w-0">
                            <SettingRow
                                label={t('Format')}
                                htmlFor={`${id}-format`}
                            >
                                <ToggleGroup
                                    id={`${id}-format`}
                                    type="single"
                                    variant="segmented"
                                    aria-label={t('Format')}
                                    value={format}
                                    onValueChange={setFormat}
                                    options={[
                                        { value: 'png', label: 'PNG' },
                                        { value: 'svg', label: 'SVG' },
                                    ]}
                                />
                            </SettingRow>
                            <SettingRow
                                label={t('Background')}
                                htmlFor={`${id}-background`}
                                help={t("With the board's background")}
                            >
                                <Switch
                                    id={`${id}-background`}
                                    checked={background}
                                    onCheckedChange={setBackground}
                                />
                            </SettingRow>
                            <SettingRow
                                label={t('Size')}
                                htmlFor={`${id}-size`}
                                help={
                                    format === 'svg'
                                        ? t('An SVG stays sharp at every size.')
                                        : undefined
                                }
                            >
                                <ToggleGroup
                                    id={`${id}-size`}
                                    type="single"
                                    variant="segmented"
                                    aria-label={t('Size')}
                                    value={size}
                                    onValueChange={setSize}
                                    disabled={format === 'svg'}
                                    options={[
                                        { value: '1', label: '1×' },
                                        { value: '2', label: '2×' },
                                        { value: '3', label: '3×' },
                                    ]}
                                />
                            </SettingRow>
                            {hasSelection && (
                                <SettingRow
                                    label={t('Only the selection')}
                                    htmlFor={`${id}-selection`}
                                >
                                    <Switch
                                        id={`${id}-selection`}
                                        checked={selectionOnly}
                                        onCheckedChange={setSelectionOnly}
                                    />
                                </SettingRow>
                            )}
                        </div>
                        <div
                            data-slot="export-preview"
                            className="bg-dotgrid flex h-56 min-w-0 items-center justify-center overflow-hidden rounded-lg border p-3"
                        >
                            {empty && (
                                <p className="text-center text-body-sm text-muted-foreground">
                                    {t('Nothing to draw yet.')}
                                </p>
                            )}
                            {drawsImage && shown === null && (
                                <Skeleton className="size-full" />
                            )}
                            {shown !== null && shown.url !== null && (
                                <img
                                    src={shown.url}
                                    alt={t('Preview')}
                                    className="max-h-full max-w-full object-contain"
                                />
                            )}
                        </div>
                    </div>
                )}
                <DialogError
                    error={
                        failed || (drawsImage && shown?.url === null)
                            ? t('Something went wrong. Please try again.')
                            : undefined
                    }
                />
            </div>
            <div className="flex flex-wrap items-center justify-end gap-3 border-t px-5 py-3">
                <Button
                    type="button"
                    variant="outline"
                    className="max-w-full min-w-0"
                    onClick={onClose}
                >
                    <span className="truncate">{t('Cancel')}</span>
                </Button>
                <LoadingButton
                    type="button"
                    loading={saving}
                    disabled={what === 'image' && empty}
                    className="max-w-full min-w-0"
                    onClick={() => void download()}
                >
                    <Download aria-hidden />
                    <span className="truncate">{t('Download')}</span>
                </LoadingButton>
            </div>
        </>
    );
}

/**
 * The two ways out of a board, an image or its data file, in the
 * application's own dialog: the drawing library's export windows are turned
 * off. The form lives only while the dialog is open, so it opens on its
 * defaults each time.
 */
export function ExportDialog({ open, onOpenChange, ...form }: Props) {
    const { t } = useTrans();
    const restoreFocus = useRestoreFocus(open);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent
                aria-describedby={undefined}
                onCloseAutoFocus={restoreFocus}
                className="gap-0 p-0 sm:max-w-3xl"
            >
                <DialogTitle className="px-5 pt-5 pr-14">
                    {t('Export the board')}
                </DialogTitle>
                <ExportForm {...form} onClose={() => onOpenChange(false)} />
            </DialogContent>
        </Dialog>
    );
}
