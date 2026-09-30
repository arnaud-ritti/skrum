import { Sparkles } from 'lucide-react';
import { useState } from 'react';
import SurveyDraftsController from '@/actions/App/Http/Controllers/Retros/SurveyDraftsController';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useTrans } from '@/hooks/use-trans';
import { retroRequest } from '@/lib/retro/api';
import { useBoard } from './board-context';

export type GeneratedSurvey = {
    question: string;
    description: string | null;
    options: string[];
};

type Props = {
    kind: 'single' | 'multiple' | 'text';
    onDraft: (draft: GeneratedSurvey) => void;
};

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
        <div className="grid gap-2 rounded-md border border-dashed p-3">
            <Label htmlFor="survey-draft-prompt">
                {t('Generate from a prompt')}
            </Label>
            <div className="flex gap-2">
                <Input
                    id="survey-draft-prompt"
                    value={prompt}
                    maxLength={300}
                    placeholder={t('Describe the survey you need')}
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
                    disabled={busy || prompt.trim() === ''}
                    onClick={() => void generate()}
                >
                    <Sparkles className="size-4" />
                    {t('Generate')}
                </Button>
            </div>
            <p className="text-xs text-muted-foreground">
                {t('Your prompt and the retro title are sent to :provider.', {
                    provider: llmProvider ?? '',
                })}
            </p>
            <InputError message={error ?? undefined} />
        </div>
    );
}
