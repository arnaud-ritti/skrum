import { describe, expect, it } from 'vitest';
import { initialNoteEditor, noteEditorReducer } from './note-editor';

const note = (body: string, version: number) => ({
    cardId: 'a',
    body,
    version,
    updatedAt: null,
});

describe('noteEditorReducer', () => {
    it('starts from the server note', () => {
        expect(initialNoteEditor(note('x', 2))).toEqual({
            draft: 'x',
            serverBody: 'x',
            serverVersion: 2,
            baseVersion: 2,
            sentBody: null,
            status: 'idle',
            conflictText: null,
        });
    });

    it('marks an edit dirty, sends it, and settles on the saved note', () => {
        let state = initialNoteEditor(note('x', 2));

        state = noteEditorReducer(state, { type: 'edit', draft: 'xy' });
        expect(state.status).toBe('dirty');

        state = noteEditorReducer(state, { type: 'send' });
        expect(state).toMatchObject({ status: 'saving', sentBody: 'xy' });

        state = noteEditorReducer(state, {
            type: 'saved',
            note: note('xy', 3),
        });
        expect(state).toMatchObject({
            status: 'saved',
            serverVersion: 3,
            draft: 'xy',
        });
    });

    it('stays dirty when typing went on while saving', () => {
        let state = noteEditorReducer(initialNoteEditor(note('', 0)), {
            type: 'edit',
            draft: 'a',
        });

        state = noteEditorReducer(state, { type: 'send' });
        state = noteEditorReducer(state, { type: 'edit', draft: 'ab' });
        state = noteEditorReducer(state, { type: 'saved', note: note('a', 1) });

        expect(state).toMatchObject({
            status: 'dirty',
            draft: 'ab',
            serverVersion: 1,
        });
    });

    it('takes the server text on a conflict and keeps the own text aside', () => {
        let state = noteEditorReducer(initialNoteEditor(note('base', 1)), {
            type: 'edit',
            draft: 'mine',
        });

        state = noteEditorReducer(state, { type: 'send' });
        state = noteEditorReducer(state, {
            type: 'conflict',
            note: note('theirs', 2),
        });

        expect(state).toMatchObject({
            status: 'conflict',
            draft: 'theirs',
            serverVersion: 2,
            conflictText: 'mine',
        });

        state = noteEditorReducer(state, { type: 'dismissConflict' });
        expect(state).toMatchObject({ status: 'idle', conflictText: null });
    });

    it('follows a note from someone else only while the viewer has nothing unsaved', () => {
        const clean = noteEditorReducer(initialNoteEditor(note('a', 1)), {
            type: 'server',
            note: note('b', 2),
        });
        const dirty = noteEditorReducer(
            noteEditorReducer(initialNoteEditor(note('a', 1)), {
                type: 'edit',
                draft: 'mine',
            }),
            { type: 'server', note: note('b', 2) },
        );

        expect(clean).toMatchObject({
            draft: 'b',
            serverVersion: 2,
            status: 'idle',
        });
        expect(clean.baseVersion).toBe(2);
        expect(dirty).toMatchObject({
            draft: 'mine',
            serverVersion: 2,
            baseVersion: 1,
            status: 'dirty',
        });
    });

    it('saves an unsaved draft from the version it was written on, after a newer note from someone else', () => {
        let state = noteEditorReducer(initialNoteEditor(note('a', 1)), {
            type: 'edit',
            draft: 'mine',
        });

        state = noteEditorReducer(state, { type: 'send' });
        state = noteEditorReducer(state, { type: 'failed' });
        state = noteEditorReducer(state, {
            type: 'server',
            note: note('theirs', 2),
        });
        state = noteEditorReducer(state, { type: 'send' });

        expect(state).toMatchObject({
            draft: 'mine',
            baseVersion: 1,
            serverVersion: 2,
        });

        state = noteEditorReducer(state, {
            type: 'conflict',
            note: note('theirs', 2),
        });

        expect(state).toMatchObject({
            status: 'conflict',
            draft: 'theirs',
            baseVersion: 2,
            conflictText: 'mine',
        });
    });

    it('writes on top of its own save once the answer comes back', () => {
        let state = noteEditorReducer(initialNoteEditor(note('', 0)), {
            type: 'edit',
            draft: 'a',
        });

        state = noteEditorReducer(state, { type: 'send' });
        state = noteEditorReducer(state, { type: 'edit', draft: 'ab' });
        state = noteEditorReducer(state, { type: 'saved', note: note('a', 1) });

        expect(state.baseVersion).toBe(1);
    });

    it('takes a newer note from someone else that landed while its own save was in flight', () => {
        let state = initialNoteEditor(note('x', 2));

        state = noteEditorReducer(state, { type: 'edit', draft: 'mine' });
        state = noteEditorReducer(state, { type: 'send' });
        state = noteEditorReducer(state, {
            type: 'server',
            note: note('theirs', 4),
        });
        state = noteEditorReducer(state, {
            type: 'saved',
            note: note('mine', 3),
        });

        expect(state).toMatchObject({
            draft: 'theirs',
            serverBody: 'theirs',
            serverVersion: 4,
            baseVersion: 4,
            status: 'idle',
        });
    });

    it('keeps typing that went on, on its own save, when a newer note landed meanwhile', () => {
        let state = initialNoteEditor(note('x', 2));

        state = noteEditorReducer(state, { type: 'edit', draft: 'mine' });
        state = noteEditorReducer(state, { type: 'send' });
        state = noteEditorReducer(state, { type: 'edit', draft: 'mine more' });
        state = noteEditorReducer(state, {
            type: 'server',
            note: note('theirs', 4),
        });
        state = noteEditorReducer(state, {
            type: 'saved',
            note: note('mine', 3),
        });

        expect(state).toMatchObject({
            draft: 'mine more',
            serverBody: 'theirs',
            serverVersion: 4,
            baseVersion: 3,
            status: 'dirty',
        });
    });

    it('ignores a server note no newer than the one it holds', () => {
        const state = initialNoteEditor(note('a', 2));

        expect(
            noteEditorReducer(state, { type: 'server', note: note('old', 2) }),
        ).toBe(state);
    });

    it('says a failed save', () => {
        let state = noteEditorReducer(initialNoteEditor(note('', 0)), {
            type: 'edit',
            draft: 'a',
        });

        state = noteEditorReducer(state, { type: 'send' });
        state = noteEditorReducer(state, { type: 'failed' });

        expect(state).toMatchObject({ status: 'failed', draft: 'a' });
    });
});
