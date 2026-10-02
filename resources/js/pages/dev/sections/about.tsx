import type { ReactNode } from 'react';
import { AboutContent } from '@/components/about/about-content';
import type { AvatarStyleAttribution } from '@/components/about/about-content';
import type { BenchGroup } from '@/components/dev/bench';
import { useTrans } from '@/hooks/use-trans';

export const group: BenchGroup = 'skrum';

const attributions: AvatarStyleAttribution[] = [
    {
        style: 'fun-emoji',
        name: 'Fun Emoji',
        source: 'Fun Emoji Set',
        creator: 'Davis Uche',
        license: 'CC BY 4.0',
        sourceUrl: 'https://www.figma.com/community/file/968125295144990435',
    },
    {
        style: 'adventurer',
        name: 'Adventurer',
        source: 'Adventurer',
        creator: 'Lisa Wischofsky',
        license: 'CC BY 4.0',
        sourceUrl: 'https://www.figma.com/community/file/1184595184137881796',
    },
    {
        style: 'personas',
        name: 'Personas, a style with a very long name that must not overflow',
        source: 'Personas by Draftbit',
        creator: 'Draftbit - draftbit.com',
        license: 'CC BY 4.0',
        sourceUrl: null,
    },
];

function Example({ label, children }: { label: string; children: ReactNode }) {
    return (
        <div className="flex min-w-0 flex-col gap-2">
            <p className="text-sm font-medium text-muted-foreground">{label}</p>
            {children}
        </div>
    );
}

export default function AboutSection() {
    const { t } = useTrans();

    return (
        <div className="flex flex-col gap-8 p-4 md:p-6">
            <Example label={t('With attributions and a GIF provider')}>
                <AboutContent
                    name="Nordlys Rituals"
                    version="1.8.0"
                    poweredBy
                    attributions={{
                        avatarStyles: attributions,
                        gifProvider: 'giphy',
                    }}
                />
            </Example>
            <Example label={t('Nothing to attribute, no "Powered by" line')}>
                <AboutContent
                    name="Skrüm"
                    version="1.8.0"
                    poweredBy={false}
                    attributions={{ avatarStyles: [], gifProvider: null }}
                />
            </Example>
        </div>
    );
}
