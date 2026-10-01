import { render } from '@testing-library/react';
import type { RenderOptions, RenderResult } from '@testing-library/react';
import type { ReactElement, ReactNode } from 'react';
import { TooltipProvider } from '@/components/ui/tooltip';

function Providers({ children }: { children: ReactNode }) {
    return <TooltipProvider delayDuration={0}>{children}</TooltipProvider>;
}

export function renderWithProviders(
    ui: ReactElement,
    options?: Omit<RenderOptions, 'wrapper'>,
): RenderResult {
    return render(ui, { wrapper: Providers, ...options });
}
