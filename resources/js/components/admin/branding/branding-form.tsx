import { useForm } from '@inertiajs/react';
import {
    Image,
    KeyRound,
    Palette as PaletteIcon,
    RotateCcw,
    Type,
    UserRound,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import BrandingController from '@/actions/App/Http/Controllers/Admin/BrandingController';
import { AvatarStylePicker } from '@/components/skrum/avatar-style-picker';
import { ConfirmDialog } from '@/components/skrum/confirm-dialog';
import { TextField } from '@/components/skrum/text-field';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { useTrans } from '@/hooks/use-trans';
import { AssetUploader } from './asset-uploader';
import {
    countChanges,
    followsDefault,
    initialFormData,
    toPayload,
} from './branding';
import type {
    BrandAssetName,
    BrandingFormData,
    BrandingPageProps,
} from './branding';
import {
    BrandingVisitError,
    removeAsset,
    resetBranding,
    uploadAsset,
} from './branding-api';
import { ColorField } from './color-field';
import { DefaultHint } from './default-hint';
import { GifSettings } from './gif-settings';
import { PreviewPane } from './preview-pane';
import { RadiusControl } from './radius-control';
import { UnsavedBar } from './unsaved-bar';
import { usePalettePreview } from './use-palette-preview';
import type { PreviewError } from './use-palette-preview';

const SampleNames = ['Ada Lovelace', 'Grace Hopper'];

type AssetState = Partial<Record<BrandAssetName, string>>;

export type BrandingFormProps = BrandingPageProps & {
    /** The admin's own name: their avatar is the first sample of each style. */
    adminName: string;
    /** Moves the focus to the form on mount, for the remount that follows a save. */
    focusOnMount?: boolean;
};

export function BrandingForm({
    adminName,
    focusOnMount = false,
    ...props
}: BrandingFormProps) {
    const { t } = useTrans();
    const container = useRef<HTMLDivElement>(null);
    const initial = initialFormData(props);
    const form = useForm<BrandingFormData>(initial);
    const [fieldsVersion, setFieldsVersion] = useState(0);
    const [assetErrors, setAssetErrors] = useState<AssetState>({});
    const [uploading, setUploading] = useState<BrandAssetName | null>(null);
    const [resetting, setResetting] = useState(false);
    const [resetError, setResetError] = useState<string>();
    const { data, errors } = form;

    useEffect(() => {
        if (focusOnMount) {
            container.current?.focus();
        }
    }, [focusOnMount]);
    const preview = usePalettePreview({
        color: data.brand_color,
        fallbackColor: props.defaults.brandColor,
        initialPalette: props.palette,
    });
    const changes = countChanges(
        toPayload(initial, props),
        toPayload(data, props),
    );
    const defaulted = followsDefault(data, props);
    const selectedStyle = props.avatarStyles.find(
        (style) => style.value === data.avatar_style,
    );

    function previewMessage(error: PreviewError | null): string | undefined {
        if (error === null) {
            return undefined;
        }

        if (error.type === 'server') {
            return error.message;
        }

        return error.type === 'invalid'
            ? t('Enter a hex colour with 3 or 6 digits, such as #2B63B0.')
            : t('The preview is unavailable. The last result is shown.');
    }

    function forgetTypedKey(): void {
        form.setData((current) => ({
            ...current,
            gif_key: '',
            gif_key_clear: false,
        }));
        setFieldsVersion((version) => version + 1);
    }

    function save(event: FormEvent<HTMLFormElement>): void {
        event.preventDefault();

        if (changes === 0 || form.processing) {
            return;
        }

        form.transform((current) => toPayload(current, props));
        form.put(BrandingController.update.url(), {
            preserveScroll: true,
            onSuccess: forgetTypedKey,
        });
    }

    function cancel(): void {
        form.reset();
        form.clearErrors();
        setFieldsVersion((version) => version + 1);
    }

    function upload(asset: BrandAssetName, file: File): void {
        setUploading(asset);
        setAssetErrors((current) => ({ ...current, [asset]: undefined }));

        uploadAsset(asset, file)
            .catch((error: unknown) => {
                const message =
                    error instanceof BrandingVisitError && error.errors.file
                        ? error.errors.file
                        : t('The image could not be saved. Try again.');

                setAssetErrors((current) => ({ ...current, [asset]: message }));
            })
            .finally(() => setUploading(null));
    }

    async function remove(asset: BrandAssetName): Promise<void> {
        setAssetErrors((current) => ({ ...current, [asset]: undefined }));

        try {
            await removeAsset(asset);
        } catch (error) {
            setAssetErrors((current) => ({
                ...current,
                [asset]: t('The image could not be removed. Try again.'),
            }));

            throw error;
        }
    }

    async function reset(): Promise<void> {
        setResetError(undefined);

        try {
            await resetBranding();
        } catch (error) {
            setResetError(t('The reset did not go through. Try again.'));

            throw error;
        }
    }

    const uploaders: Array<{
        asset: BrandAssetName;
        label: string;
        description: string;
        url: string | null;
        surface: 'light' | 'dark';
    }> = [
        {
            asset: 'logo-light',
            label: t('Logo, light theme'),
            description: t('Shown in the sidebar and on the sign-in pages.'),
            url: props.assets.logoLightUrl,
            surface: 'light',
        },
        {
            asset: 'logo-dark',
            label: t('Logo, dark theme'),
            description: t('Optional. The light logo is used without it.'),
            url: props.assets.logoDarkUrl,
            surface: 'dark',
        },
        {
            asset: 'favicon',
            label: t('Favicon'),
            description: t('The icon of the browser tab.'),
            url: props.assets.faviconUrl,
            surface: 'light',
        },
    ];

    return (
        <div
            ref={container}
            tabIndex={-1}
            data-slot="branding-form"
            className="@container flex min-w-0 flex-col gap-6 outline-none"
        >
            <form
                onSubmit={save}
                aria-label={t('Branding')}
                className="grid min-w-0 grid-cols-1 items-start gap-6 @3xl:grid-cols-[minmax(0,1fr)_20rem]"
            >
                <UnsavedBar
                    count={changes}
                    saving={form.processing}
                    onCancel={cancel}
                    className="sticky top-16 z-20 @3xl:col-span-2"
                />
                <div className="flex min-w-0 flex-col gap-6">
                    <Card
                        title={t('Identity')}
                        description={t(
                            'The name and images that replace Skrüm for everyone.',
                        )}
                    >
                        <CardContent className="flex flex-col gap-5">
                            <TextField
                                label={t('Display name')}
                                icon={Type}
                                value={data.display_name}
                                placeholder={props.defaults.displayName}
                                description={
                                    defaulted.displayName
                                        ? t('Default: :name', {
                                              name: props.defaults.displayName,
                                          })
                                        : undefined
                                }
                                maxLength={60}
                                error={errors.display_name}
                                onChange={(event) =>
                                    form.setData(
                                        'display_name',
                                        event.target.value,
                                    )
                                }
                            />
                            <Switch
                                checked={data.powered_by}
                                onCheckedChange={(checked) =>
                                    form.setData('powered_by', checked)
                                }
                                label={t('Show "Powered by Skrüm"')}
                                description={
                                    <>
                                        {t(
                                            'A discreet mention on the sign-in pages and the About page.',
                                        )}
                                        {defaulted.poweredBy && (
                                            <DefaultHint className="ml-2" />
                                        )}
                                    </>
                                }
                            />
                            <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,--spacing(52)),1fr))] gap-3">
                                {uploaders.map((uploader) => (
                                    <AssetUploader
                                        key={uploader.asset}
                                        label={uploader.label}
                                        description={uploader.description}
                                        url={uploader.url}
                                        surface={uploader.surface}
                                        busy={uploading === uploader.asset}
                                        error={assetErrors[uploader.asset]}
                                        onUpload={(file) =>
                                            upload(uploader.asset, file)
                                        }
                                        onRemove={() => remove(uploader.asset)}
                                    />
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                    <Card
                        title={t('Colour and shape')}
                        description={t(
                            'The brand colour replaces the primary colour, the focus ring and the links only.',
                        )}
                    >
                        <CardContent className="flex flex-col gap-5">
                            <ColorField
                                value={data.brand_color}
                                onChange={(value) =>
                                    form.setData('brand_color', value)
                                }
                                defaultColor={props.defaults.brandColor}
                                palette={preview.palette}
                                loading={preview.loading}
                                error={
                                    errors.brand_color ??
                                    previewMessage(preview.error)
                                }
                            />
                            <RadiusControl
                                value={data.brand_radius}
                                onChange={(value) =>
                                    form.setData('brand_radius', value)
                                }
                                error={errors.brand_radius}
                            />
                        </CardContent>
                    </Card>
                    <Card
                        title={t('Avatars')}
                        description={t(
                            'The style of the avatars drawn for members and guests.',
                        )}
                    >
                        <CardContent className="flex flex-col gap-3">
                            {defaulted.avatarStyle && (
                                <p
                                    data-slot="avatar-style-default"
                                    className="flex min-w-0 flex-wrap items-center gap-2 text-body-sm text-muted-foreground"
                                >
                                    <DefaultHint />
                                    <span className="min-w-0">
                                        {t(
                                            'The style of the environment applies until you choose another one.',
                                        )}
                                    </span>
                                </p>
                            )}
                            <AvatarStylePicker
                                value={data.avatar_style}
                                onChange={(style) =>
                                    form.setData('avatar_style', style)
                                }
                                options={props.avatarStyles.map((style) => ({
                                    value: style.value,
                                    name: style.name,
                                    license: style.license,
                                    attribution: style.attributionRequired
                                        ? (style.attribution ?? undefined)
                                        : undefined,
                                    sampleUrls: style.sampleUrls,
                                }))}
                                sampleNames={[adminName, ...SampleNames]}
                                allowMemberChoice={data.avatar_member_choice}
                                onAllowMemberChoiceChange={(allow) =>
                                    form.setData('avatar_member_choice', allow)
                                }
                            />
                            {errors.avatar_style && (
                                <p
                                    data-slot="field-error"
                                    className="text-body-sm text-skrum-destructive-text"
                                >
                                    {errors.avatar_style}
                                </p>
                            )}
                            {selectedStyle?.attributionRequired &&
                                selectedStyle.attribution && (
                                    <p
                                        data-slot="avatar-attribution"
                                        className="flex min-w-0 items-start gap-2 text-body-sm text-muted-foreground"
                                    >
                                        <UserRound
                                            aria-hidden="true"
                                            className="mt-0.5 size-4 shrink-0"
                                        />
                                        <span className="min-w-0">
                                            {t(
                                                'This style requires attribution, shown on the About page: :attribution',
                                                {
                                                    attribution:
                                                        selectedStyle.attribution,
                                                },
                                            )}
                                        </span>
                                    </p>
                                )}
                        </CardContent>
                    </Card>
                    <Card
                        title={t('GIFs')}
                        description={t(
                            'The search used in retros, icebreakers and sprint reviews.',
                        )}
                    >
                        <CardContent>
                            <GifSettings
                                key={fieldsVersion}
                                hasKey={props.hasGifKey}
                                defaulted={{
                                    provider: defaulted.gifProvider,
                                    enabled: defaulted.gifEnabled,
                                    rating: defaulted.gifRating,
                                }}
                                value={{
                                    provider: data.gif_provider,
                                    enabled: data.gif_enabled,
                                    rating: data.gif_rating,
                                    key: data.gif_key,
                                    keyClear: data.gif_key_clear,
                                }}
                                onChange={(patch) =>
                                    form.setData((current) => ({
                                        ...current,
                                        gif_provider:
                                            patch.provider ??
                                            current.gif_provider,
                                        gif_enabled:
                                            patch.enabled ??
                                            current.gif_enabled,
                                        gif_rating:
                                            patch.rating ?? current.gif_rating,
                                        gif_key: patch.key ?? current.gif_key,
                                        gif_key_clear:
                                            patch.keyClear ??
                                            current.gif_key_clear,
                                    }))
                                }
                                errors={{
                                    provider: errors.gif_provider,
                                    enabled: errors.gif_enabled,
                                    rating: errors.gif_rating,
                                    key: errors.gif_key,
                                }}
                            />
                        </CardContent>
                    </Card>
                </div>
                <PreviewPane
                    palette={preview.palette}
                    radius={data.brand_radius}
                    loading={preview.loading}
                    className="@3xl:sticky @3xl:top-36"
                />
            </form>
            <Card
                title={t('Reset to Skrüm')}
                description={t(
                    'Go back to the Skrüm look and to the settings of the environment.',
                )}
            >
                <CardContent>
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => setResetting(true)}
                        className="max-w-full min-w-0 text-skrum-destructive-text"
                    >
                        <RotateCcw aria-hidden="true" />
                        <span className="truncate">{t('Reset to Skrüm')}</span>
                    </Button>
                </CardContent>
            </Card>
            <ConfirmDialog
                open={resetting}
                onOpenChange={setResetting}
                tone="destructive"
                title={t('Reset the branding?')}
                description={t(
                    'Every instance setting of this page is deleted. This cannot be undone.',
                )}
                consequences={[
                    {
                        icon: PaletteIcon,
                        label: t('The colour and the radius return to Skrüm.'),
                    },
                    {
                        icon: Image,
                        label: t('The logos and the favicon are deleted.'),
                    },
                    {
                        icon: Type,
                        label: t('The display name returns to the default.'),
                    },
                    {
                        icon: UserRound,
                        label: t(
                            'The avatar style and the member choice return to the default.',
                        ),
                    },
                    {
                        icon: KeyRound,
                        label: t(
                            'The GIF provider, rating and API key are deleted.',
                        ),
                    },
                ]}
                confirmLabel={t('Reset to Skrüm')}
                error={resetError}
                onConfirm={reset}
            />
        </div>
    );
}
