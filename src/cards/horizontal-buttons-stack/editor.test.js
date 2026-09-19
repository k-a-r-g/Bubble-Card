import { describe, expect, jest, test } from '@jest/globals';

jest.unstable_mockModule('../../tools/localize.js', () => ({
    default: () => (key) => key,
}));

jest.unstable_mockModule('../../tools/utils.js', () => ({
    fireEvent: jest.fn(),
}));

const { renderHorButtonStackEditor } = await import('./editor.js');

function buildEditor(config) {
    return {
        _config: config,
        hass: {},
        buttonAdded: false,
        requestUpdate: jest.fn(),
        makeDropdown: jest.fn(() => ''),
        makeLayoutPanel: jest.fn(() => ''),
        makeStyleEditor: jest.fn(() => ''),
        makeModulesEditor: jest.fn(() => ''),
        makeVersion: jest.fn(() => ''),
        makeActionPanel: jest.fn(() => ''),
        _optionalLabel: (label) => `Optional - ${label}`,
        _valueChanged: jest.fn(),
        _computeLabelCallback: jest.fn(),
        cardTypeList: [],
    };
}

describe('horizontal buttons stack editor actions', () => {
    test('discovers an action-only button and renders all three action panels', () => {
        const action = { tap_action: { action: 'toggle' } };
        const editor = buildEditor({ '1_button_action': action });

        renderHorButtonStackEditor(editor);

        expect(editor.buttonIndex).toBe(1);
        expect(editor.makeActionPanel.mock.calls).toEqual([
            ['tap', action, 'none', '1_button_action'],
            ['double_tap', action, 'none', '1_button_action'],
            ['hold', action, 'none', '1_button_action'],
        ]);
    });
});
