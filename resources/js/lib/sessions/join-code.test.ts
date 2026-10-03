import { describe, expect, it } from 'vitest';
import {
    formatAsTyped,
    joinHost,
    JoinCodeAlphabet,
    normaliseJoinCode,
} from '@/lib/sessions/join-code';

describe('normaliseJoinCode', () => {
    it.each([
        ['K7Q-P4M2', 'K7Q-P4M2'],
        ['k7q-p4m2', 'K7Q-P4M2'],
        ['k7qp4m2', 'K7Q-P4M2'],
        [' K7Q P4M2 ', 'K7Q-P4M2'],
        ['K7Q-P4M', null],
        ['K7Q-P4M22', null],
        ['K0Q-P4M2', null],
        ['KOQ-P4M2', null],
        ['K1Q-P4M2', null],
        ['KIQ-P4M2', null],
        ['K7Q_P4M2', null],
    ])('reads %j as %j', (typed, code) => {
        expect(normaliseJoinCode(typed)).toBe(code);
    });

    it('leaves out the look-alikes of the server alphabet', () => {
        expect(JoinCodeAlphabet).toBe('ABCDEFGHJKMNPQRSTUVWXYZ23456789');
    });
});

describe('formatAsTyped', () => {
    it.each([
        ['', ''],
        ['k', 'K'],
        ['k7q', 'K7Q'],
        ['k7qp', 'K7Q-P'],
        ['K7Q-', 'K7Q-'],
        ['k7q-p4m2', 'K7Q-P4M2'],
        ['k7q p4m2', 'K7Q-P4M2'],
        ['k7qp4m2x', 'K7Q-P4M2'],
    ])('shows %j as %j', (typed, shown) => {
        expect(formatAsTyped(typed)).toBe(shown);
    });
});

describe('joinHost', () => {
    it.each([
        ['https://skrum.example/join', 'skrum.example/join'],
        ['http://localhost:8000/join/', 'localhost:8000/join'],
        ['https://skrum.example/app/join', 'skrum.example/app/join'],
    ])('shows %j as %j', (url, host) => {
        expect(joinHost(url)).toBe(host);
    });
});
