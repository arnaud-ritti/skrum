import { useState } from 'react';
import type { ReactNode } from 'react';
import { AssetUploader } from '@/components/admin/branding/asset-uploader';
import { ColorField } from '@/components/admin/branding/color-field';
import { ContrastBadge } from '@/components/admin/branding/contrast-badge';
import { GifSettings } from '@/components/admin/branding/gif-settings';
import type { GifSettingsValue } from '@/components/admin/branding/gif-settings';
import { PaletteWarnings } from '@/components/admin/branding/palette-warnings';
import { PreviewPane } from '@/components/admin/branding/preview-pane';
import { RadiusControl } from '@/components/admin/branding/radius-control';
import {
    adjustedPalette,
    samplePalette,
    weakPalette,
} from '@/components/admin/branding/samples';
import { UnsavedBar } from '@/components/admin/branding/unsaved-bar';
import type { BenchGroup } from '@/components/dev/bench';
import { useTrans } from '@/hooks/use-trans';

export const group: BenchGroup = 'skrum';

const noop = (): void => {};
const settled = (): Promise<void> => Promise.resolve();

function Example({ label, children }: { label: string; children: ReactNode }) {
    return (
        <div className="flex min-w-0 flex-col gap-2">
            <p className="text-sm font-medium text-muted-foreground">{label}</p>
            {children}
        </div>
    );
}

function InteractiveColor() {
    const [value, setValue] = useState('#FFD600');

    return (
        <ColorField
            value={value}
            onChange={setValue}
            defaultColor="#bb4d2a"
            palette={adjustedPalette}
        />
    );
}

function InteractiveRadius() {
    const [value, setValue] = useState(10);

    return <RadiusControl value={value} onChange={setValue} />;
}

function InteractiveGif({ hasKey }: { hasKey: boolean }) {
    const [value, setValue] = useState<GifSettingsValue>({
        provider: 'giphy',
        enabled: true,
        rating: 'g',
        key: '',
        keyClear: false,
    });

    return (
        <GifSettings
            hasKey={hasKey}
            value={value}
            onChange={(patch) => setValue({ ...value, ...patch })}
        />
    );
}

export default function AdminBrandingSection() {
    const { t } = useTrans();

    return (
        <div className="flex flex-col gap-8 p-4 md:p-6">
            <Example
                label={t('Unsaved changes bar: clean, one change, saving')}
            >
                <div className="flex flex-col gap-2">
                    <UnsavedBar count={0} onCancel={noop} />
                    <UnsavedBar count={1} onCancel={noop} />
                    <UnsavedBar count={4} saving onCancel={noop} />
                </div>
            </Example>
            <Example label={t('Contrast badges: AAA, AA, below AA')}>
                <div className="flex flex-wrap gap-2">
                    <ContrastBadge ratio={7.2} />
                    <ContrastBadge ratio={5.8} />
                    <ContrastBadge ratio={3.1} />
                </div>
            </Example>
            <Example label={t('Palette warnings')}>
                <PaletteWarnings
                    warnings={[
                        ...adjustedPalette.warnings,
                        ...weakPalette.warnings,
                    ]}
                />
            </Example>
            <Example label={t('Colour field: entered and applied values')}>
                <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,--spacing(80)),1fr))] gap-6">
                    <InteractiveColor />
                    <ColorField
                        value="#12"
                        onChange={noop}
                        defaultColor="#bb4d2a"
                        palette={samplePalette}
                        error={t(
                            'Enter a hex colour with 3 or 6 digits, such as #2B63B0.',
                        )}
                    />
                    <ColorField
                        value=""
                        onChange={noop}
                        defaultColor="#bb4d2a"
                        palette={weakPalette}
                        loading
                    />
                </div>
            </Example>
            <Example label={t('Radius: presets and exact value')}>
                <InteractiveRadius />
            </Example>
            <Example
                label={t('Live preview: light and dark, square and round')}
            >
                <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,--spacing(72)),1fr))] gap-4">
                    <PreviewPane palette={samplePalette} radius={10} />
                    <PreviewPane
                        palette={samplePalette}
                        radius={10}
                        defaultTheme="dark"
                    />
                    <PreviewPane palette={adjustedPalette} radius={0} />
                    <PreviewPane
                        palette={adjustedPalette}
                        radius={16}
                        defaultTheme="dark"
                        loading
                    />
                </div>
            </Example>
            <Example
                label={t('Image uploader: empty, with an image, busy, refused')}
            >
                <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,--spacing(52)),1fr))] gap-3">
                    <AssetUploader
                        label={t('Logo, light theme')}
                        description={t(
                            'Shown in the sidebar and on the sign-in pages.',
                        )}
                        url={null}
                        onUpload={noop}
                        onRemove={settled}
                    />
                    <AssetUploader
                        label={t('Logo, dark theme')}
                        url="/favicon.svg"
                        surface="dark"
                        onUpload={noop}
                        onRemove={settled}
                    />
                    <AssetUploader
                        label={t('Favicon')}
                        url="/favicon.svg"
                        busy
                        onUpload={noop}
                        onRemove={settled}
                    />
                    <AssetUploader
                        label={t(
                            'A very long image label that has to truncate',
                        )}
                        url={null}
                        error={t('Use a PNG, JPEG, WebP or SVG image.')}
                        onUpload={noop}
                        onRemove={settled}
                    />
                </div>
            </Example>
            <Example label={t('GIF settings: a key is set')}>
                <InteractiveGif hasKey />
            </Example>
            <Example label={t('GIF settings: no key yet')}>
                <InteractiveGif hasKey={false} />
            </Example>
        </div>
    );
}
