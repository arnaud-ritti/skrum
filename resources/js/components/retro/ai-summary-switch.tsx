import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { useTrans } from '@/hooks/use-trans';

type Props = {
    id: string;
    provider: string;
    checked: boolean;
    disabled?: boolean;
    onChange: (checked: boolean) => void;
};

export function AiSummarySwitch({
    id,
    provider,
    checked,
    disabled = false,
    onChange,
}: Props) {
    const { t } = useTrans();

    return (
        <div className="grid gap-1">
            <div className="flex items-center gap-2">
                <Checkbox
                    id={id}
                    checked={checked}
                    disabled={disabled}
                    onCheckedChange={(value) => onChange(value === true)}
                />
                <Label htmlFor={id}>{t('Automatic AI summary')}</Label>
            </div>
            <p className="text-xs text-muted-foreground">
                {t(
                    'When the retro is completed, its board content is sent automatically to :provider to write a summary. Participants can also ask it to suggest group names. Turn this off to keep it on this server.',
                    { provider },
                )}
            </p>
        </div>
    );
}
