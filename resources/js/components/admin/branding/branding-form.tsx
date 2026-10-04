import { useForm } from '@inertiajs/react';
import {
    Image,
    KeyRound,
    Palette as PaletteIcon,
    RotateCcw,
    Type,
    UserRound,
} from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import BrandingController from '@/actions/App/Http/Controllers/Admin/BrandingController';
import { ConfirmDialog } from '@/components/skrum/confirm-dialog';
import { TextField } from '@/components/skrum/text-field';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { ToggleGroup } from '@/components/ui/toggle-group';
import { useTrans } from '@/hooks/use-trans';
import { AssetUploader } from './asset-uploader';
import { AvatarStyleGrid } from './avatar-style-grid';
import {
    BrandAssetNames,
    countChanges,
    followsDefault,
    initialFormData,
    isRadiusPreset,
    toPayload,
} from './branding';
import type {
    BrandAssetName,
    BrandingFormData,
    BrandingPageProps,
    ThemeName,
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
import { useStagedAssets } from './use-staged-assets';

type AssetState = Partial<Record<BrandAssetName, string>>;

type BrandingFormProps = BrandingPageProps & {
    /** The admin's own name: their avatar is the sample of each style. */
    adminName: string;
    /** Moves the focus to the form on mount, for the remount that follows a save. */
    focusOnMount?: boolean;
    /**
     * Places the unsaved-changes bar and the form: the page hands the bar to
     * the topbar. Without it the bar sits above the form.
     */
    frame?: (bar: ReactNode, content: ReactNode) => ReactNode;
};

function stacked(bar: ReactNode, content: ReactNode): ReactNode {
    return (
        <div className="flex min-w-0 flex-col gap-4">
            <div className="flex justify-end">{bar}</div>
            {content}
        </div>
    );
}

export function BrandingForm({
    adminName,
    focusOnMount = false,
    frame = stacked,
    ...props
}: BrandingFormProps) {
    const { t } = useTrans();
    const formId = useId();
    const headingId = useId();
    const container = useRef<HTMLDivElement>(null);
    const initial = initialFormData(props);
    const form = useForm<BrandingFormData>(initial);
    const assets = useStagedAssets();
    const [fieldsVersion, setFieldsVersion] = useState(0);
    const [assetErrors, setAssetErrors] = useState<AssetState>({});
    const [variant, setVariant] = useState<BrandAssetName>('logo-light');
    const [sendingAsset, setSendingAsset] = useState<BrandAssetName | null>(
        null,
    );
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
    const fieldChanges = countChanges(
        toPayload(initial, props),
        toPayload(data, props),
    );
    const changes = fieldChanges + assets.count;
    const [submitting, setSubmitting] = useState(false);
    const submittingRef = useRef(false);
    const saving = form.processing || sendingAsset !== null || submitting;
    const defaulted = followsDefault(data, props);
    const selectedStyle = props.avatarStyles.find(
        (style) => style.value === data.avatar_style,
    );
    const storedUrls: Record<BrandAssetName, string | null> = {
        'logo-light': props.assets.logoLightUrl,
        'logo-dark': props.assets.logoDarkUrl,
        favicon: props.assets.faviconUrl,
        'logo-mail': props.assets.logoMailUrl,
    };

    /** What Save would leave: a staged file, nothing after a staged removal, else the stored image. */
    function shownUrl(asset: BrandAssetName): string | null {
        const staged = assets.staged[asset];

        if (staged === undefined) {
            return storedUrls[asset];
        }

        return staged.type === 'file' ? staged.url : null;
    }

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

    /** Sends the staged images one by one; stops at the first refusal. */
    async function sendStagedAssets(): Promise<boolean> {
        for (const asset of BrandAssetNames) {
            const staged = assets.staged[asset];

            if (staged === undefined) {
                continue;
            }

            setSendingAsset(asset);

            try {
                await (staged.type === 'file'
                    ? uploadAsset(asset, staged.file)
                    : removeAsset(asset));
            } catch (error) {
                const fallback =
                    staged.type === 'file'
                        ? t('The image could not be saved. Try again.')
                        : t('The image could not be removed. Try again.');
                const message =
                    error instanceof BrandingVisitError && error.errors.file
                        ? error.errors.file
                        : fallback;

                setAssetErrors((current) => ({ ...current, [asset]: message }));
                setVariant(asset);
                setSendingAsset(null);

                return false;
            }

            assets.drop(asset);
        }

        setSendingAsset(null);

        return true;
    }

    function settle(): void {
        submittingRef.current = false;
        setSubmitting(false);
    }

    async function save(event: FormEvent<HTMLFormElement>): Promise<void> {
        event.preventDefault();

        // A ref, not the render's state: Enter twice submits before a render.
        if (changes === 0 || saving || submittingRef.current) {
            return;
        }

        submittingRef.current = true;
        setSubmitting(true);
        setAssetErrors({});

        if (!(await sendStagedAssets()) || fieldChanges === 0) {
            settle();

            return;
        }

        form.transform((current) => toPayload(current, props));
        form.put(BrandingController.update.url(), {
            preserveScroll: true,
            onSuccess: forgetTypedKey,
            onFinish: settle,
        });
    }

    function cancel(): void {
        form.reset();
        form.clearErrors();
        assets.clear();
        setAssetErrors({});
        setFieldsVersion((version) => version + 1);
    }

    function stageFile(asset: BrandAssetName, file: File): void {
        setAssetErrors((current) => ({ ...current, [asset]: undefined }));
        assets.stageFile(asset, file);
    }

    function stageRemoval(asset: BrandAssetName): void {
        setAssetErrors((current) => ({ ...current, [asset]: undefined }));
        assets.stageRemoval(asset);
    }

    function undoStaged(asset: BrandAssetName): void {
        setAssetErrors((current) => ({ ...current, [asset]: undefined }));
        assets.drop(asset);
    }

    async function reset(): Promise<void> {
        setResetError(undefined);

        try {
            await resetBranding();
        } catch (error) {
            setResetError(t('The reset did not go through. Try again.'));

            throw error;
        }

        cancel();
    }

    const uploaders: Record<
        BrandAssetName,
        {
            label: string;
            description?: string;
            hint?: string;
            fallback: string;
            /** A PNG or JPEG here gives e-mails a logo. */
            drawnInMail: boolean;
            surface: ThemeName;
        }
    > = {
        'logo-light': {
            label: t('Light logo'),
            description: t('Shown in the sidebar and on the sign-in pages.'),
            fallback: t('The default logo is shown instead.'),
            drawnInMail: true,
            surface: 'light',
        },
        'logo-dark': {
            label: t('Dark logo'),
            description: t('Optional. The light logo is used without it.'),
            fallback: t('The light logo is used instead.'),
            drawnInMail: false,
            surface: 'dark',
        },
        favicon: {
            label: t('Favicon'),
            description: t('The icon of the browser tab.'),
            fallback: t('The default icon is shown instead.'),
            drawnInMail: false,
            surface: 'light',
        },
        'logo-mail': {
            label: t('Logo for e-mails'),
            hint: t(
                'PNG or JPEG, at least 128 px wide. Mail clients do not draw SVG.',
            ),
            fallback: t('E-mails use the light logo or the name instead.'),
            drawnInMail: true,
            surface: 'light',
        },
    };
    const uploader = uploaders[variant];
    const mailWarning =
        props.assets.mailShowsName && uploader.drawnInMail
            ? t(
                  'E-mails show the name as text until a PNG or JPEG logo is added.',
              )
            : undefined;
    const stagedVariant = assets.staged[variant];

    const bar = (
        <UnsavedBar
            count={changes}
            saving={saving}
            onCancel={cancel}
            form={formId}
        />
    );

    const content = (
        <div
            ref={container}
            tabIndex={-1}
            data-slot="branding-form"
            className="@container flex min-w-0 flex-col gap-6 outline-none"
        >
            <form
                id={formId}
                onSubmit={(event) => void save(event)}
                aria-label={t('Branding')}
                className="flex min-w-0 flex-col gap-6"
            >
                <fieldset disabled={saving} className="contents">
                    <section
                        aria-labelledby={headingId}
                        className="flex min-w-0 flex-col gap-3"
                    >
                        <div className="flex min-w-0 flex-wrap items-end justify-between gap-x-4 gap-y-2">
                            <div className="flex min-w-0 flex-col gap-1">
                                <h2
                                    id={headingId}
                                    className="text-xl font-title tracking-heading"
                                >
                                    {t('Branding')}
                                </h2>
                                <p className="text-sm/snug text-muted-foreground">
                                    {t(
                                        'Logo, colour and corners applied to the whole instance, guests included.',
                                    )}
                                </p>
                            </div>
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                data-slot="branding-reset"
                                disabled={saving}
                                onClick={() => setResetting(true)}
                                className="max-w-full min-w-0"
                            >
                                <RotateCcw aria-hidden="true" />
                                <span className="truncate">
                                    {t('Back to Skrüm')}
                                </span>
                            </Button>
                        </div>
                        <Card>
                            <CardContent className="grid min-w-0 grid-cols-1 items-start gap-8 @3xl:grid-cols-[minmax(0,1fr)_--spacing(110)]">
                                <div className="flex min-w-0 flex-col gap-5">
                                    <div
                                        data-slot="logo-field"
                                        className="flex min-w-0 flex-col gap-1.5"
                                    >
                                        <Label asChild>
                                            <span>{t('Logo')}</span>
                                        </Label>
                                        <ToggleGroup
                                            type="single"
                                            variant="segmented"
                                            fullWidth
                                            className="grid grid-cols-2"
                                            aria-label={t('Logo')}
                                            value={variant}
                                            onValueChange={setVariant}
                                            options={BrandAssetNames.map(
                                                (asset) => ({
                                                    value: asset,
                                                    label: uploaders[asset]
                                                        .label,
                                                }),
                                            )}
                                        />
                                        <AssetUploader
                                            key={variant}
                                            label={uploader.label}
                                            description={uploader.description}
                                            hint={uploader.hint}
                                            warning={mailWarning}
                                            url={shownUrl(variant)}
                                            fileName={
                                                stagedVariant?.type === 'file'
                                                    ? stagedVariant.file.name
                                                    : undefined
                                            }
                                            staged={stagedVariant !== undefined}
                                            surface={uploader.surface}
                                            busy={sendingAsset === variant}
                                            disabled={saving}
                                            fallback={uploader.fallback}
                                            error={assetErrors[variant]}
                                            onUpload={(file) =>
                                                stageFile(variant, file)
                                            }
                                            onRemove={() =>
                                                stageRemoval(variant)
                                            }
                                            onUndo={() => undoStaged(variant)}
                                        />
                                    </div>
                                    <TextField
                                        label={t('Display name')}
                                        icon={Type}
                                        value={data.display_name}
                                        placeholder={props.defaults.displayName}
                                        description={
                                            defaulted.displayName
                                                ? t('Default: :name', {
                                                      name: props.defaults
                                                          .displayName,
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
                                        exact={
                                            props.brandRadius !== null &&
                                            !isRadiusPreset(props.brandRadius)
                                        }
                                        onChange={(value) =>
                                            form.setData('brand_radius', value)
                                        }
                                        error={errors.brand_radius}
                                    />
                                    <div
                                        data-slot="avatar-style-field"
                                        className="flex min-w-0 flex-col gap-1.5"
                                    >
                                        <Label asChild>
                                            <span>{t('Avatar style')}</span>
                                        </Label>
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
                                        <AvatarStyleGrid
                                            value={data.avatar_style}
                                            onChange={(style) =>
                                                form.setData(
                                                    'avatar_style',
                                                    style,
                                                )
                                            }
                                            options={props.avatarStyles}
                                            sampleName={adminName}
                                            allowMemberChoice={
                                                data.avatar_member_choice
                                            }
                                            onAllowMemberChoiceChange={(
                                                allow,
                                            ) =>
                                                form.setData(
                                                    'avatar_member_choice',
                                                    allow,
                                                )
                                            }
                                            allowProfilePhotos={
                                                data.profile_photos
                                            }
                                            onAllowProfilePhotosChange={(
                                                allow,
                                            ) =>
                                                form.setData(
                                                    'profile_photos',
                                                    allow,
                                                )
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
                                    </div>
                                </div>
                                <PreviewPane
                                    palette={preview.palette}
                                    radius={data.brand_radius}
                                    loading={preview.loading}
                                    name={
                                        data.display_name.trim() === ''
                                            ? props.defaults.displayName
                                            : data.display_name.trim()
                                    }
                                    logos={{
                                        light: shownUrl('logo-light'),
                                        dark: shownUrl('logo-dark'),
                                    }}
                                    avatar={{
                                        name: adminName,
                                        src: selectedStyle?.sampleUrls[0],
                                    }}
                                    className="@3xl:sticky @3xl:top-20"
                                />
                            </CardContent>
                        </Card>
                    </section>
                    <Card
                        title={t('Sign-in pages')}
                        description={t(
                            'What visitors see before they are signed in.',
                        )}
                    >
                        <CardContent>
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
                </fieldset>
            </form>
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
                        label: t(
                            'The colour and the radius return to the default.',
                        ),
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
                    {
                        icon: Image,
                        label: t(
                            'Profile photos and "Powered by Skrüm" return to the default.',
                        ),
                    },
                ]}
                confirmLabel={t('Reset to Skrüm')}
                error={resetError}
                onConfirm={reset}
            />
        </div>
    );

    return frame(bar, content);
}
