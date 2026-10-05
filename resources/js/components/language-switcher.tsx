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
import { localeName } from '@/lib/locale-names';
import { cn } from '@/lib/utils';

export function LanguageSwitcher({ className }: { className?: string }) {
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
            <SelectTrigger
                className={cn('w-40', className)}
                aria-label={t('Language')}
            >
                <SelectValue />
            </SelectTrigger>
            <SelectContent>
                {locales.map((code) => (
                    <SelectItem key={code} value={code}>
                        <span lang={code}>{localeName(code)}</span>
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    );
}
