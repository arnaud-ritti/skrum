import type { SessionKind } from './session-shell';

/** English keys; the shell translates them with t(). Each states only what is true for its session type. */
export const ReconnectingHints: Record<SessionKind, string> = {
    retro: 'Live updates are paused. What you see may be out of date.',
    poker: 'Live updates are paused. What you see may be out of date.',
    game: 'Live updates are paused. The round may have moved on.',
    whiteboard:
        "Live updates are paused. Other people's changes appear when the connection returns.",
};
