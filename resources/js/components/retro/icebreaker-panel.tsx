import { Sparkles } from 'lucide-react';
import { useTrans } from '@/hooks/use-trans';
import { useBoard } from './board-context';

export function warmUpQuestions(t: (key: string) => string): string[] {
    return [
        t('What was the highlight of your week?'),
        t('What is one small thing that made you smile recently?'),
        t('If this sprint were a movie, what would its title be?'),
        t('What is a skill you would like to learn this year?'),
        t('Which song describes your mood today?'),
        t('What is the best piece of advice you have received at work?'),
        t(
            'If you could have any superpower for one day, which would you choose?',
        ),
        t('What is something you are looking forward to?'),
        t('Describe the last sprint in three words.'),
        t('What is your favourite way to recharge after a busy week?'),
        t('Which tool or habit saved you the most time recently?'),
        t('If our team were a band, what kind of music would we play?'),
    ];
}

export function warmUpIndex(retroId: string, count: number): number {
    let hash = 0;

    for (const character of retroId) {
        hash = (hash * 31 + character.charCodeAt(0)) % 1_000_003;
    }

    return hash % count;
}

export function IcebreakerPanel() {
    const { t } = useTrans();
    const { board } = useBoard();
    const questions = warmUpQuestions(t);
    const question = questions[warmUpIndex(board.retro.id, questions.length)];

    return (
        <section aria-labelledby="warm-up-title" className="border-b p-4">
            <div className="mx-auto max-w-xl space-y-2 rounded-lg border bg-muted/30 p-6 text-center">
                <p
                    id="warm-up-title"
                    className="flex items-center justify-center gap-2 text-sm font-medium text-muted-foreground"
                >
                    <Sparkles className="size-4" />
                    {t('Warm-up')}
                </p>
                <p className="text-xl font-semibold text-balance">{question}</p>
                <p className="text-sm text-muted-foreground">
                    {t('Take turns answering before the retrospective starts.')}
                </p>
            </div>
        </section>
    );
}
