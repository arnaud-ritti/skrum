import { router, usePage } from '@inertiajs/react';
import LocalesController from '@/actions/App/Http/Controllers/LocalesController';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { useTrans } from '@/hooks/use-trans';

const localeNames: Record<string, string> = {
    en: 'English',
    fr: 'Français',
    es: 'Español',
    de: 'Deutsch',
};

export function LanguageSwitcher() {
    const { locale, locales } = usePage().props;
    const { t } = useTrans();

    return (
        <Select
            value={locale}
            onValueChange={(value) =>
                router.put(
                    LocalesController.update.url(),
                    { locale: value },
                    { preserveScroll: true },
                )
            }
        >
            <SelectTrigger className="w-40" aria-label={t('Language')}>
                <SelectValue />
            </SelectTrigger>
            <SelectContent>
                {locales.map((code) => (
                    <SelectItem key={code} value={code}>
                        {t(localeNames[code])}
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    );
}
