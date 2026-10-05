import { router, usePage } from '@inertiajs/react';
import { useState } from 'react';
import type { ReactElement } from 'react';
import LocalesController from '@/actions/App/Http/Controllers/LocalesController';
import { ToggleGroup } from '@/components/ui/toggle-group';
import { useTrans } from '@/hooks/use-trans';
import { localeName } from '@/lib/locale-names';

export function LanguageField(): ReactElement {
    const { locale, locales } = usePage().props;
    const { t } = useTrans();
    const [saving, setSaving] = useState(false);

    return (
        <div
            data-slot="language-field"
            className="flex min-w-0 flex-wrap items-center justify-between gap-x-4 gap-y-3"
        >
            <div className="flex min-w-0 flex-1 basis-72 flex-col">
                <span className="text-sm font-medium">{t('Language')}</span>
                <span className="text-xs text-muted-foreground">
                    {t('Interface language. Guests follow their browser.')}
                </span>
            </div>
            <ToggleGroup
                type="single"
                variant="segmented"
                aria-label={t('Language')}
                value={locale}
                disabled={saving}
                onValueChange={(value) =>
                    router.put(
                        LocalesController.update.url(),
                        { locale: value },
                        {
                            preserveScroll: true,
                            onStart: () => setSaving(true),
                            onFinish: () => setSaving(false),
                        },
                    )
                }
                options={locales.map((code) => ({
                    value: code,
                    label: localeName(code),
                    lang: code,
                }))}
            />
        </div>
    );
}
