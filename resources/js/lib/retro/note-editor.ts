import type { TopicNote } from './types';

export type NoteEditorState = {
    draft: string;
    serverBody: string;
    serverVersion: number;
    /** The version the draft was written on, sent with the save. */
    baseVersion: number;
    /** The text of the save in flight. */
    sentBody: string | null;
    status: 'idle' | 'dirty' | 'saving' | 'saved' | 'failed' | 'conflict';
    /** The viewer's text a conflict replaced, kept on screen to copy. */
    conflictText: string | null;
};

export type NoteEditorAction =
    | { type: 'edit'; draft: string }
    | { type: 'send' }
    | { type: 'saved'; note: TopicNote }
    | { type: 'conflict'; note: TopicNote }
    | { type: 'failed' }
    | { type: 'server'; note: TopicNote }
    | { type: 'dismissConflict' };

export function initialNoteEditor(note: TopicNote): NoteEditorState {
    return {
        draft: note.body,
        serverBody: note.body,
        serverVersion: note.version,
        baseVersion: note.version,
        sentBody: null,
        status: 'idle',
        conflictText: null,
    };
}

function hasUnsaved(state: NoteEditorState): boolean {
    return (
        state.status === 'dirty' ||
        state.status === 'saving' ||
        state.status === 'failed'
    );
}

/**
 * The notes of one topic in front of one viewer (spec §6.6): the text typed,
 * the last version the server holds, the version the text was written on,
 * and the save in flight. A newer note from someone else never moves the
 * version an unsaved text is sent from, so a save from an older version
 * comes back as a conflict: the server's text replaces the
 * field and the viewer's own text is kept aside, never lost silently.
 */
export function noteEditorReducer(
    state: NoteEditorState,
    action: NoteEditorAction,
): NoteEditorState {
    switch (action.type) {
        case 'edit':
            return { ...state, draft: action.draft, status: 'dirty' };
        case 'send':
            return { ...state, sentBody: state.draft, status: 'saving' };
        case 'saved':
            return {
                ...state,
                serverBody: action.note.body,
                serverVersion: action.note.version,
                baseVersion: action.note.version,
                sentBody: null,
                status: state.draft === state.sentBody ? 'saved' : 'dirty',
            };
        case 'conflict':
            return {
                ...state,
                draft: action.note.body,
                serverBody: action.note.body,
                serverVersion: action.note.version,
                baseVersion: action.note.version,
                sentBody: null,
                status: 'conflict',
                conflictText: state.draft,
            };
        case 'failed':
            return { ...state, sentBody: null, status: 'failed' };
        case 'server':
            if (action.note.version <= state.serverVersion) {
                return state;
            }

            if (hasUnsaved(state)) {
                return {
                    ...state,
                    serverBody: action.note.body,
                    serverVersion: action.note.version,
                };
            }

            return {
                ...state,
                draft: action.note.body,
                serverBody: action.note.body,
                serverVersion: action.note.version,
                baseVersion: action.note.version,
                status: 'idle',
            };
        case 'dismissConflict':
            return {
                ...state,
                conflictText: null,
                status: state.status === 'conflict' ? 'idle' : state.status,
            };
    }
}
