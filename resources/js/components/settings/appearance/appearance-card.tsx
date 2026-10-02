import type { ReactElement, ReactNode } from 'react';
import { LanguageField } from '@/components/settings/appearance/language-field';
import { ThemePicker } from '@/components/settings/appearance/theme-picker';
import { SettingsCard } from '@/components/settings/settings-card';
import { Separator } from '@/components/ui/separator';
import { useAppearance } from '@/hooks/use-appearance';
import { useTrans } from '@/hooks/use-trans';

type AppearanceCardProps = {
    /** Place left under the language for the "Reduce animations" row (AC-5). */
    reduceAnimations?: ReactNode;
    /** Place left under the card for the Accessibility card (plan 18f, B35). */
    accessibility?: ReactNode;
};

export function AppearanceCard({
    reduceAnimations,
    accessibility,
}: AppearanceCardProps): ReactElement {
    const { t } = useTrans();
    const { appearance, updateAppearance } = useAppearance();

    return (
        <>
            <SettingsCard
                title={t('Appearance')}
                description={t(
                    'The theme is kept on this device. The language is saved on your account.',
                )}
            >
                <ThemePicker value={appearance} onChange={updateAppearance} />
                <Separator />
                <LanguageField />
                {reduceAnimations !== undefined && (
                    <>
                        <Separator />
                        <div data-slot="appearance-reduce-animations">
                            {reduceAnimations}
                        </div>
                    </>
                )}
            </SettingsCard>
            {accessibility}
        </>
    );
}
