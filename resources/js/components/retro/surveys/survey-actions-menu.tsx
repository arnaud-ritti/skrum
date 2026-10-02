import { Ellipsis, Lock, LockOpen, Pencil, Trash2 } from 'lucide-react';
import { useState } from 'react';
import SurveyClosuresController from '@/actions/App/Http/Controllers/Retros/SurveyClosuresController';
import SurveysController from '@/actions/App/Http/Controllers/Retros/SurveysController';
import { ConfirmDialog } from '@/components/skrum/confirm-dialog';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useTrans } from '@/hooks/use-trans';
import { retroRequest } from '@/lib/retro/api';
import { SurveyPhases } from '@/lib/retro/survey-api';
import type { SurveyPayload } from '@/lib/retro/types';
import { useBoard } from '../board-context';
import { SurveyEditorDialog, useSurveyEditor } from './survey-editor-dialog';

type SurveyResponse = { survey: SurveyPayload };

/** What the facilitator does with a survey: edit, show names, close, delete. */
export function SurveyActionsMenu({ survey }: { survey: SurveyPayload }) {
    const ctx = useBoard();
    const { t } = useTrans();
    const editor = useSurveyEditor();
    const [confirmingDelete, setConfirmingDelete] = useState(false);
    const [busy, setBusy] = useState(false);
    const { retro, viewer } = ctx.board;

    if (!viewer.isFacilitator || retro.phase === 'completed') {
        return null;
    }

    const canEdit = ctx.isEditable && SurveyPhases.includes(retro.phase);
    const route = { retro: retro.id, survey: survey.id };

    const send = async (request: Promise<SurveyResponse>) => {
        setBusy(true);

        const response = await ctx.run(request).finally(() => setBusy(false));

        if (response) {
            ctx.invalidateSurvey(response.survey.id);
            ctx.apply({ type: 'survey.upsert', survey: response.survey });
        }
    };

    const destroy = async () => {
        const result = await ctx.run(
            retroRequest(SurveysController.destroy(route)),
        );

        if (result === undefined) {
            throw new Error('The survey was not deleted.');
        }

        ctx.apply({ type: 'survey.remove', surveyId: survey.id });
    };

    return (
        <>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button
                        size="icon-sm"
                        variant="ghost"
                        className="-my-1 shrink-0"
                        aria-label={t('Survey actions')}
                        disabled={busy}
                    >
                        <Ellipsis aria-hidden />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="max-w-64">
                    <DropdownMenuItem
                        disabled={!canEdit || survey.responseCount > 0}
                        onSelect={() => editor.openEdit(survey)}
                    >
                        <Pencil aria-hidden />
                        <span className="truncate">{t('Edit survey')}</span>
                    </DropdownMenuItem>
                    {survey.responseCount > 0 && (
                        <p className="px-2 pb-1 text-xs/snug text-muted-foreground">
                            {t(
                                'Edit is only possible before the first answer.',
                            )}
                        </p>
                    )}
                    <DropdownMenuCheckboxItem
                        checked={survey.showVoters}
                        disabled={retro.isAnonymous}
                        onCheckedChange={(checked) =>
                            void send(
                                retroRequest<SurveyResponse>(
                                    SurveysController.update(route),
                                    { show_voters: checked === true },
                                ),
                            )
                        }
                    >
                        <span className="truncate">
                            {t('Show who answered')}
                        </span>
                    </DropdownMenuCheckboxItem>
                    <DropdownMenuItem
                        onSelect={() =>
                            void send(
                                retroRequest<SurveyResponse>(
                                    survey.isClosed
                                        ? SurveyClosuresController.destroy(
                                              route,
                                          )
                                        : SurveyClosuresController.update(
                                              route,
                                          ),
                                ),
                            )
                        }
                    >
                        {survey.isClosed ? (
                            <LockOpen aria-hidden />
                        ) : (
                            <Lock aria-hidden />
                        )}
                        <span className="truncate">
                            {survey.isClosed
                                ? t('Reopen survey')
                                : t('Close survey')}
                        </span>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                        variant="destructive"
                        disabled={!canEdit}
                        onSelect={() => setConfirmingDelete(true)}
                    >
                        <Trash2 aria-hidden />
                        <span className="truncate">{t('Delete survey')}</span>
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
            <SurveyEditorDialog editor={editor} />
            <ConfirmDialog
                open={confirmingDelete && !ctx.sessionExpired}
                onOpenChange={setConfirmingDelete}
                tone="destructive"
                title={t('Delete this survey?')}
                description={t(
                    'Its answers, reactions and comments are deleted too.',
                )}
                confirmLabel={t('Delete')}
                onConfirm={destroy}
            />
        </>
    );
}
