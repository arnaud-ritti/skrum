import type { ReactNode } from 'react';

type Props = { title: string; children: ReactNode };

export function ResultsSection({ title, children }: Props) {
    return (
        <section className="space-y-3">
            <h2 className="text-base font-semibold">{title}</h2>
            {children}
        </section>
    );
}
