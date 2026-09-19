import { describe, expect, test } from '@jest/globals';
import { getConfiguredButtonIndexes, getLastConfiguredButtonIndex, hasButtonConfig } from './config.js';

describe('horizontal buttons stack numbered button discovery', () => {
    test('keeps legacy link-backed buttons', () => {
        const config = { '1_link': '#kitchen' };

        expect(hasButtonConfig(config, 1)).toBe(true);
        expect(getConfiguredButtonIndexes(config)).toEqual([1]);
    });

    test('discovers action-only buttons and ignores unrelated numbered display fields', () => {
        const config = {
            '1_link': '#kitchen',
            '2_name': 'All lights',
            '2_entity': 'light.all_lights',
            '2_button_action': { tap_action: { action: 'toggle' } },
            '4_icon': 'mdi:ghost',
        };

        expect(getConfiguredButtonIndexes(config)).toEqual([1, 2]);
        expect(getLastConfiguredButtonIndex(config)).toBe(2);
    });

    test('allows an explicitly configured action object without a link', () => {
        const config = { '3_button_action': {} };

        expect(hasButtonConfig(config, 3)).toBe(true);
        expect(getConfiguredButtonIndexes(config)).toEqual([3]);
    });
});
