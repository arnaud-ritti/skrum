import { Children, type ReactNode } from 'react';

/** What everyone on the board needs to know right now; nothing when calm. */
export function StatusBar({ children }: { children: ReactNode }) {
    if (Children.toArray(children).length === 0) {
        return null;
    }

    return (
        <div
            role="status"
            className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b bg-muted/40 px-4 py-1.5 text-sm"
        >
            {children}
        </div>
    );
}
