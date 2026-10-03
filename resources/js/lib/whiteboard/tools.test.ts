import { describe, expect, it } from 'vitest';
import {
    BoardToolKeys,
    DefaultToolChoices,
    PhoneBarTools,
    PhoneDrawerTools,
    StickyToolType,
    ToolGroups,
    ToolKeys,
    canvasToolFor,
    choicesAfter,
    toolOf,
} from './tools';

describe('tools', () => {
    it('lists the tools of ScreenWhiteboard in its order and groups', () => {
        expect(ToolGroups).toEqual([
            ['select', 'hand'],
            ['sticky', 'shape', 'connector', 'text', 'pen', 'eraser', 'frame'],
            ['image'],
        ]);
        expect(ToolKeys).toEqual({
            select: 'V',
            hand: 'H',
            sticky: 'N',
            shape: 'R',
            connector: 'C',
            text: 'T',
            pen: 'P',
            eraser: 'E',
            frame: 'F',
            image: null,
        });
        expect(BoardToolKeys).toEqual(['sticky', 'connector']);
    });

    it('offers no connector and no frame on a phone', () => {
        expect(PhoneBarTools).toEqual(['select', 'sticky', 'pen']);
        expect(PhoneDrawerTools).toEqual([
            'hand',
            'shape',
            'text',
            'eraser',
            'image',
        ]);
    });

    it('reads the library tool as one of the board tools', () => {
        expect(toolOf({ type: 'selection' })).toBe('select');
        expect(toolOf({ type: 'diamond' })).toBe('shape');
        expect(toolOf({ type: 'line' })).toBe('connector');
        expect(toolOf({ type: 'freedraw' })).toBe('pen');
        expect(toolOf({ type: 'custom', customType: StickyToolType })).toBe(
            'sticky',
        );
        expect(toolOf({ type: 'custom', customType: 'other' })).toBeNull();
        expect(toolOf({ type: 'laser' })).toBeNull();
    });

    it('asks the library for the remembered shape and connector', () => {
        const choices = {
            ...DefaultToolChoices,
            shape: 'ellipse' as const,
            connector: 'line' as const,
        };

        expect(canvasToolFor('shape', choices)).toEqual({ type: 'ellipse' });
        expect(canvasToolFor('connector', choices)).toEqual({ type: 'line' });
        expect(canvasToolFor('sticky', choices)).toEqual({
            type: 'custom',
            customType: StickyToolType,
        });
        expect(canvasToolFor('select', choices)).toEqual({ type: 'selection' });
        expect(canvasToolFor('pen', choices)).toEqual({ type: 'freedraw' });
        expect(canvasToolFor('image', choices)).toEqual({ type: 'image' });
    });

    it('remembers a shape or a connector chosen with the library keys', () => {
        expect(
            choicesAfter({ type: 'diamond' }, DefaultToolChoices).shape,
        ).toBe('diamond');
        expect(
            choicesAfter({ type: 'line' }, DefaultToolChoices).connector,
        ).toBe('line');
        expect(choicesAfter({ type: 'text' }, DefaultToolChoices)).toBe(
            DefaultToolChoices,
        );
    });
});
