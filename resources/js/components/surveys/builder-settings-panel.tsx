import { Settings2, VenetianMask } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { useTrans } from '@/hooks/use-trans';
import type { SurveySettingsPatch } from '@/lib/surveys/api';

export type BuilderSettings = {
    oneQuestionAtATime: boolean;
    showResultsAfterAnswer: boolean;
    guestAccessEnabled: boolean;
};

type BuilderSettingsPanelProps = {
    settings: BuilderSettings;
    onChange: (patch: SurveySettingsPatch) => void;
    /** Inside the phone's sheet, which carries the title itself. */
    showHeading?: boolean;
};

/**
 * The settings of the survey, saved on each switch. The anonymity choice, the
 * closing date and the display threshold of the mockup are not settings of
 * this release (P19-01 to P19-03): their places stay empty.
 */
export function BuilderSettingsPanel({
    settings,
    onChange,
    showHeading = true,
}: BuilderSettingsPanelProps) {
    const { t } = useTrans();

    return (
        <div data-slot="survey-settings" className="flex flex-col gap-5">
            {showHeading && (
                <div className="flex items-center justify-between gap-2">
                    <h2 className="text-lg font-semibold">{t('Settings')}</h2>
                    <Settings2
                        aria-hidden
                        className="size-4 text-muted-foreground"
                    />
                </div>
            )}
            <p className="flex items-center gap-2 text-sm font-semibold">
                <VenetianMask
                    aria-hidden
                    className="size-4 shrink-0 text-muted-foreground"
                />
                {t('Answers are anonymous')}
            </p>
            <Separator />
            <div className="flex flex-col gap-3">
                <Switch
                    id="survey-one-at-a-time"
                    label={t('One question at a time')}
                    description={t('Recommended on a phone')}
                    checked={settings.oneQuestionAtATime}
                    onCheckedChange={(checked) =>
                        onChange({ one_question_at_a_time: checked })
                    }
                />
                <Switch
                    id="survey-results-after"
                    label={t('Show results after answering')}
                    checked={settings.showResultsAfterAnswer}
                    onCheckedChange={(checked) =>
                        onChange({ show_results_after_answer: checked })
                    }
                />
                <Switch
                    id="survey-guests"
                    label={t('Allow guests without an account')}
                    checked={settings.guestAccessEnabled}
                    onCheckedChange={(checked) =>
                        onChange({ guest_access_enabled: checked })
                    }
                />
            </div>
        </div>
    );
}
