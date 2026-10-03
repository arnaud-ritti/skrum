import {
    ChartBar,
    CircleDot,
    Gauge,
    SquareCheck,
    TextCursorInput,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useCallback } from 'react';
import { useTrans } from '@/hooks/use-trans';
import type { SurveyKind } from '@/lib/surveys/types';

/** The five kinds, in the order of the mockup's "Add" bar. */
export const SurveyKinds: SurveyKind[] = [
    'scale',
    'nps',
    'single',
    'multiple',
    'text',
];

export const KindIcons: Record<SurveyKind, LucideIcon> = {
    scale: Gauge,
    nps: ChartBar,
    single: CircleDot,
    multiple: SquareCheck,
    text: TextCursorInput,
};

export function useKindLabel(): (kind: SurveyKind) => string {
    const { t } = useTrans();

    return useCallback(
        (kind: SurveyKind): string => {
            switch (kind) {
                case 'scale':
                    return t('Scale 1 – 5');
                case 'nps':
                    return t('NPS');
                case 'single':
                    return t('Single choice');
                case 'multiple':
                    return t('Multiple choice');
                case 'text':
                    return t('Free text');
            }
        },
        [t],
    );
}
