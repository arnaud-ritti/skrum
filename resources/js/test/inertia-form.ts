import { createElement } from 'react';
import type { ReactNode } from 'react';

type FormState = { processing: boolean; errors: Record<string, string> };

type FormSlot = FormState & { clearErrors: () => void };

export type FormMockState = FormState & {
    props: Record<string, unknown>;
    /** How many times the render prop's `clearErrors` was called. */
    cleared?: number;
};

export function createFormState(): FormMockState {
    return { processing: false, errors: {}, props: {} };
}

/**
 * Stand-in for Inertia's `<Form>` in a Vitest file: a plain form that hands
 * the given errors and processing flag to its render prop.
 */
export function formMock(state: FormMockState) {
    return function Form({
        children,
        className,
        action,
        method,
        ...props
    }: {
        children: (slot: FormSlot) => ReactNode;
        className?: string;
        action?: string;
        method?: string;
    } & Record<string, unknown>) {
        state.props = props;

        return createElement(
            'form',
            { className, action, method },
            children({
                processing: state.processing,
                errors: state.errors,
                clearErrors: () => {
                    state.cleared = (state.cleared ?? 0) + 1;
                },
            }),
        );
    };
}
