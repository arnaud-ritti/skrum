import { router } from '@inertiajs/react';
import { useState } from 'react';
import type { ReactElement } from 'react';
import ShortcutPreferencesController from '@/actions/App/Http/Controllers/Settings/ShortcutPreferencesController';
import { SettingsCard } from '@/components/settings/settings-card';
import { LoadingButton } from '@/components/skrum/loading-button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useTrans } from '@/hooks/use-trans';

type ShortcutPreferenceCardProps = {
    /** The stored preference: single-key shortcuts answer. */
    enabled: boolean;
};

const controlId = 'single-key-shortcuts';
const descriptionId = `${controlId}-description`;

export function ShortcutPreferenceCard({
    enabled,
}: ShortcutPreferenceCardProps): ReactElement {
    const { t } = useTrans();
    const [singleKey, setSingleKey] = useState(enabled);
    const [saving, setSaving] = useState(false);

    return (
        <form
            data-slot="shortcut-preference-card"
            className="min-w-0"
            onSubmit={(event) => {
                event.preventDefault();
                router.patch(
                    ShortcutPreferencesController.update.url(),
                    { single_key_shortcuts: singleKey },
                    {
                        preserveScroll: true,
                        onStart: () => setSaving(true),
                        onFinish: () => setSaving(false),
                    },
                );
            }}
        >
            <SettingsCard
                title={t('Accessibility')}
                footer={
                    <LoadingButton
                        type="submit"
                        size="sm"
                        loading={saving}
                        className="max-w-full"
                    >
                        <span className="truncate">{t('Save')}</span>
                    </LoadingButton>
                }
            >
                <div className="flex min-w-0 items-center justify-between gap-4">
                    <div className="flex min-w-0 flex-1 flex-col">
                        <Label htmlFor={controlId}>
                            {t('Single-key shortcuts')}
                        </Label>
                        <span
                            id={descriptionId}
                            className="text-xs text-muted-foreground"
                        >
                            {t(
                                'When off, shortcuts made of a single letter, digit or sign do nothing. Shortcuts with ⌘ or Ctrl, Enter, Escape and the arrows keep working.',
                            )}
                        </span>
                    </div>
                    <Switch
                        id={controlId}
                        aria-describedby={descriptionId}
                        checked={singleKey}
                        onCheckedChange={setSingleKey}
                    />
                </div>
            </SettingsCard>
        </form>
    );
}
