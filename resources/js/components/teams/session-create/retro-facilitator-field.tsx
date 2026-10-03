import { UserRoundCog } from 'lucide-react';
import type { ReactElement } from 'react';
import { SettingRow } from '@/components/teams/session-create/setting-row';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { useTrans } from '@/hooks/use-trans';
import { facilitatorChoices } from '@/lib/teams/facilitator';
import type { FacilitatorOption } from '@/types';

type RetroFacilitatorFieldProps = {
    /** The team's members who take part, alphabetical (`retroFacilitators`). */
    options: FacilitatorOption[];
    viewerId: string;
    suggestedId: string | null;
    rotation: boolean;
    value: string;
    onChange: (userId: string) => void;
    error?: string;
};

/**
 * Who facilitates the new retro (decision 4 C, no mockup: P23-05): the viewer
 * first as "Me", then the team, the suggested person marked.
 */
export function RetroFacilitatorField({
    options,
    viewerId,
    suggestedId,
    rotation,
    value,
    onChange,
    error,
}: RetroFacilitatorFieldProps): ReactElement {
    const { t } = useTrans();
    const listed = options.some((option) => option.id === viewerId)
        ? options
        : [{ id: viewerId, name: t('Me'), avatarUrl: '' }, ...options];
    const choices = facilitatorChoices(listed, viewerId);
    const suggestionShown =
        suggestedId !== null &&
        choices.some((choice) => choice.id === suggestedId);

    const label = (choice: FacilitatorOption): string => {
        const name = choice.id === viewerId ? t('Me') : choice.name;

        return choice.id === suggestedId
            ? t(':name (suggested)', { name })
            : name;
    };

    return (
        <SettingRow
            label={t('Facilitator')}
            htmlFor="new-retro-facilitator"
            help={
                rotation && suggestionShown
                    ? t('Suggested by the rotation.')
                    : undefined
            }
            icon={UserRoundCog}
            error={error}
        >
            <Select value={value} onValueChange={onChange}>
                <SelectTrigger
                    id="new-retro-facilitator"
                    size="sm"
                    aria-invalid={error !== undefined || undefined}
                    className="max-w-56"
                >
                    <SelectValue />
                </SelectTrigger>
                <SelectContent>
                    {choices.map((choice) => (
                        <SelectItem key={choice.id} value={choice.id}>
                            {label(choice)}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </SettingRow>
    );
}
