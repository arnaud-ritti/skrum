import { Copy, NotebookPen } from 'lucide-react';
import { useCallback, useEffect, useId, useReducer, useRef } from 'react';
import TopicNotesController from '@/actions/App/Http/Controllers/Retros/TopicNotesController';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useActivity } from '@/hooks/use-retro-activity';
import { useClipboard } from '@/hooks/use-clipboard';
import { useTrans } from '@/hooks/use-trans';
import { retroRequest, RetroRequestError } from '@/lib/retro/api';
import {
    initialNoteEditor,
    noteEditorReducer,
    type NoteEditorState,
} from '@/lib/retro/note-editor';
import type { TopicNote } from '@/lib/retro/types';
import { ActivityLine } from './activity-line';
import { useBoard } from './board-context';
import { useDiscussion } from './phase-discussing';

/** The pause after the last keystroke before the notes are saved. */
export const NoteSaveDelayMs = 800;

const NoteMaxLength = 5000;

type SavedAnswer = { note: TopicNote };

function conflictNote(error: unknown): TopicNote | null {
    if (!(error instanceof RetroRequestError) || error.status !== 409) {
        return null;
    }

    const payload = error.payload as { note?: TopicNote } | null;

    return payload?.note ?? null;
}

/**
 * The shared notes of the topic in front of the viewer (RT-6), in the right
 * column of Discussing. One editor per topic.
 */
export function TopicNotes() {
    const { board } = useBoard();
    const { current } = useDiscussion();

    if (board.retro.phase !== 'discussing' || current === null) {
        return null;
    }

    return <TopicNotesEditor key={current.id} cardId={current.leadCardId} />;
}

function SaveState({
    state,
    onRetry,
}: {
    state: NoteEditorState;
    onRetry: () => void;
}) {
    const { t } = useTrans();

    if (state.status === 'saving') {
        return <span>{t('Saving…')}</span>;
    }

    if (state.status === 'failed') {
        return (
            <span className="flex min-w-0 items-center gap-1 text-skrum-destructive-text">
                <span className="truncate">{t('Not saved')}</span>
                <Button
                    type="button"
                    size="sm"
                    variant="link"
                    className="h-auto px-1 py-0 text-xs"
                    onClick={onRetry}
                >
                    {t('Try again')}
                </Button>
            </span>
        );
    }

    const isStored =
        state.status === 'saved' ||
        (state.status === 'idle' && state.serverVersion > 0);

    if (isStored) {
        return <span>{t('Saved')}</span>;
    }

    return null;
}

/**
 * One writer at a time (decision 5): while someone else types here, the field
 * is read-only and says who. Every change announces the viewer's own typing;
 * 800 ms after the last one, and on blur, the text is saved from the version
 * it started from. A stale save comes back as a 409: the server's text takes
 * the field, the viewer's own is kept below with "Copy".
 */
function TopicNotesEditor({ cardId }: { cardId: string }) {
    const { board, apply, handleError, isEditable } = useBoard();
    const { t } = useTrans();
    const { entries, announce, end } = useActivity();
    const [, copy] = useClipboard();
    const titleId = useId();
    const activityId = useId();
    const lockedId = useId();
    const boardNote = board.topicNotes.find((note) => note.cardId === cardId);
    const [state, dispatch] = useReducer(
        noteEditorReducer,
        boardNote ?? { cardId, body: '', version: 0, updatedAt: null },
        initialNoteEditor,
    );
    const latest = useRef(state);
    const applyLatest = useRef(apply);
    const inFlight = useRef(false);
    const retroId = board.retro.id;
    const isLocked = !isEditable;
    const othersTyping = entries.some(
        (entry) => entry.kind === 'notes' && entry.targetId === cardId,
    );
    const isReadOnly = isLocked || othersTyping;

    useEffect(() => {
        latest.current = state;
        applyLatest.current = apply;
    });

    useEffect(() => {
        if (boardNote !== undefined) {
            dispatch({ type: 'server', note: boardNote });
        }
    }, [boardNote]);

    const save = useCallback(async (): Promise<void> => {
        if (inFlight.current) {
            return;
        }

        const { draft, baseVersion } = latest.current;

        inFlight.current = true;
        dispatch({ type: 'send' });

        try {
            const answer = await retroRequest<SavedAnswer>(
                TopicNotesController.update({ retro: retroId, card: cardId }),
                { body: draft, version: baseVersion },
            );

            dispatch({ type: 'saved', note: answer.note });
            apply({ type: 'topicNote.set', note: answer.note });
        } catch (error) {
            const current = conflictNote(error);

            if (current !== null) {
                dispatch({ type: 'conflict', note: current });
                apply({ type: 'topicNote.set', note: current });

                return;
            }

            handleError(error);
            dispatch({ type: 'failed' });
        } finally {
            inFlight.current = false;
        }
    }, [apply, handleError, retroId, cardId]);

    const isDirty = state.status === 'dirty';

    // Each change restarts the wait; a save that settles while typing went
    // on leaves the editor dirty, and the wait starts again.
    useEffect(() => {
        if (!isDirty) {
            return;
        }

        const timeout = window.setTimeout(() => {
            void save();
        }, NoteSaveDelayMs);

        return () => window.clearTimeout(timeout);
    }, [isDirty, state.draft, save]);

    useEffect(() => () => end('notes', cardId), [end, cardId]);

    // The topic changed under unsaved text: it is sent one last time, and
    // whatever comes back is left to the board. The editor is keyed by its
    // topic, so this runs on unmount only.
    useEffect(
        () => () => {
            const { draft, baseVersion, status } = latest.current;

            if (status !== 'dirty' && status !== 'failed') {
                return;
            }

            void retroRequest<SavedAnswer>(
                TopicNotesController.update({ retro: retroId, card: cardId }),
                { body: draft, version: baseVersion },
            ).then(
                (answer) =>
                    applyLatest.current({
                        type: 'topicNote.set',
                        note: answer.note,
                    }),
                () => {},
            );
        },
        [retroId, cardId],
    );

    const describedBy = isLocked ? lockedId : activityId;

    return (
        <section
            aria-labelledby={titleId}
            data-slot="retro-topic-notes"
            data-status={state.status}
            className="flex min-w-0 flex-col gap-3 rounded-xl border bg-card p-4 shadow-card"
        >
            <div className="flex min-w-0 items-center justify-between gap-3">
                <h2
                    id={titleId}
                    className="flex min-w-0 items-center gap-2 text-base font-title"
                >
                    <NotebookPen className="size-4 shrink-0" aria-hidden />
                    <span className="truncate">{t('Discussion notes')}</span>
                </h2>
                <div
                    role="status"
                    data-slot="retro-topic-notes-state"
                    className="flex min-w-0 shrink-0 items-center text-xs whitespace-nowrap text-muted-foreground"
                >
                    <SaveState state={state} onRetry={() => void save()} />
                </div>
            </div>
            <Textarea
                aria-labelledby={titleId}
                aria-describedby={isReadOnly ? describedBy : undefined}
                maxLength={NoteMaxLength}
                placeholder={t(
                    'What the room decides, the questions left open…',
                )}
                readOnly={isReadOnly}
                value={state.draft}
                className="field-sizing-content min-h-24 resize-none read-only:bg-muted"
                onChange={(event) => {
                    dispatch({ type: 'edit', draft: event.target.value });
                    announce('notes', cardId);
                }}
                onBlur={() => {
                    end('notes', cardId);

                    if (latest.current.status === 'dirty') {
                        void save();
                    }
                }}
            />
            <div id={activityId}>
                <ActivityLine kind="notes" targetId={cardId} />
            </div>
            {isLocked && (
                <p id={lockedId} className="text-xs text-muted-foreground">
                    {t('Board closed for editing')}
                </p>
            )}
            {state.conflictText !== null && (
                <Alert variant="warning" data-slot="retro-topic-notes-conflict">
                    <AlertTitle>{t('Your text was not saved')}</AlertTitle>
                    <AlertDescription className="flex min-w-0 flex-col gap-2">
                        <p className="max-h-40 min-w-0 overflow-y-auto rounded-md bg-muted px-3 py-2 text-sm break-words whitespace-pre-wrap text-muted-foreground">
                            {state.conflictText}
                        </p>
                        <div className="flex flex-wrap justify-end gap-2">
                            <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                onClick={() =>
                                    dispatch({ type: 'dismissConflict' })
                                }
                            >
                                {t('Close')}
                            </Button>
                            <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() =>
                                    void copy(state.conflictText ?? '')
                                }
                            >
                                <Copy aria-hidden />
                                {t('Copy')}
                            </Button>
                        </div>
                    </AlertDescription>
                </Alert>
            )}
        </section>
    );
}
