import { Sparkles } from 'lucide-react';
import { useState } from 'react';
import SurveyDraftsController from '@/actions/App/Http/Controllers/Retros/SurveyDraftsController';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useTrans } from '@/hooks/use-trans';
import { retroRequest } from '@/lib/retro/api';
import type { SurveyKind } from '@/lib/retro/types';
import { useBoard } from '../board-context';

export type GeneratedSurvey = {
    question: string;
    description: string | null;
    options: string[];
};

type Props = {
    kind: SurveyKind;
    onDraft: (draft: GeneratedSurvey) => void;
};

/** A prompt that fills the question and the options of a new survey. */
export function SurveyDraftField({ kind, onDraft }: Props) {
    const ctx = useBoard();
    const { t } = useTrans();
    const [prompt, setPrompt] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const { llm, llmProvider } = ctx.board.features;

    if (!llm) {
        return null;
    }

    const generate = async () => {
        const trimmed = prompt.trim();

        if (trimmed === '' || busy) {
            return;
        }

        setBusy(true);
        setError(null);

        try {
            onDraft(
                await retroRequest<GeneratedSurvey>(
                    SurveyDraftsController.store(ctx.board.retro.id),
                    { prompt: trimmed, kind },
                ),
            );
        } catch (caught) {
            setError(ctx.handleError(caught));
        } finally {
            setBusy(false);
        }
    };

    return (
        <div
            data-slot="survey-draft"
            className="grid min-w-0 gap-2 rounded-lg border border-dashed border-input bg-muted/40 p-3"
        >
            <Label
                htmlFor="survey-draft-prompt"
                className="flex min-w-0 items-center gap-2"
            >
                <Sparkles
                    aria-hidden
                    className="size-4 shrink-0 text-skrum-primary-text"
                />
                <span className="min-w-0">{t('Generate from a prompt')}</span>
            </Label>
            <div className="flex min-w-0 flex-wrap gap-2">
                <Input
                    id="survey-draft-prompt"
                    value={prompt}
                    maxLength={300}
                    placeholder={t('Describe the survey you need')}
                    className="min-w-0 flex-1 basis-48"
                    onChange={(event) => setPrompt(event.target.value)}
                    onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                            event.preventDefault();
                            void generate();
                        }
                    }}
                />
                <Button
                    type="button"
                    variant="secondary"
                    className="max-w-full min-w-0"
                    disabled={busy || prompt.trim() === ''}
                    onClick={() => void generate()}
                >
                    <Sparkles aria-hidden />
                    <span className="truncate">{t('Generate')}</span>
                </Button>
            </div>
            <p className="text-xs/snug text-muted-foreground">
                {t('Your prompt and the retro title are sent to :provider.', {
                    provider: llmProvider ?? '',
                })}
            </p>
            <InputError message={error ?? undefined} />
        </div>
    );
}
