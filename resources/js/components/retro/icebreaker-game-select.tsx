import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { useTrans } from '@/hooks/use-trans';
import type { GameKind, GameOption } from '@/lib/games/types';

type Props = {
    id: string;
    value: GameKind;
    options: GameOption[];
    disabled?: boolean;
    onChange: (game: GameKind) => void;
};

export function IcebreakerGameSelect({
    id,
    value,
    options,
    disabled = false,
    onChange,
}: Props) {
    const { t } = useTrans();
    const shown = options.filter(
        (option) => option.available || option.value === value,
    );

    return (
        <div className="grid gap-1 pl-6">
            <Label htmlFor={id}>{t('Icebreaker game')}</Label>
            <Select
                value={value}
                disabled={disabled}
                onValueChange={(next) => onChange(next as GameKind)}
            >
                <SelectTrigger id={id} className="w-56">
                    <SelectValue />
                </SelectTrigger>
                <SelectContent>
                    {shown.map((option) => (
                        <SelectItem
                            key={option.value}
                            value={option.value}
                            disabled={!option.available}
                        >
                            {option.label}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
    );
}
