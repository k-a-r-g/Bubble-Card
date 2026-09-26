import { afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals';

// updateSlider decides one thing, whether the fill has to move, so the fakes
// only have to answer where the fill is and what the entity carries.

jest.unstable_mockModule('../../tools/utils.js', () => ({
    isStateOn: jest.fn(() => true),
    getStateSurfaceColor: jest.fn(() => 'rgb(1, 2, 3)'),
}));

jest.unstable_mockModule('../../tools/icon.js', () => ({
    getLightColorSignature: jest.fn(() => 'signature'),
}));

const setRangeFillTransform = jest.fn((context, percentage) => {
    context._lastVisualFillPercentage = percentage;
});

// An input_number from -10 to 10, so 0 sits at the middle of the rail.
const percentageOf = (context, entity) => ((Number(context._hass.states[entity].state) + 10) / 20) * 100;

jest.unstable_mockModule('./helpers.js', () => ({
    getEntityMinValue: jest.fn(() => -10),
    getEntityMaxValue: jest.fn(() => 10),
    getEntityStep: jest.fn(() => 1),
    getAdjustedValue: jest.fn((value) => value),
    clampPercentage: jest.fn((value) => value),
    fromPercentageToValue: jest.fn(() => 0),
    getCurrentPercentage: jest.fn(percentageOf),
    formatDisplayValue: jest.fn(() => ''),
    formatDisplayValueFromEntity: jest.fn(() => ''),
    toVisualPercentage: jest.fn((context, percentage) => percentage),
    toActualPercentage: jest.fn((context, percentage) => percentage),
    getFillOrientation: jest.fn(() => 'left'),
    setRangeFillTransform,
    isInstantSliderWrite: jest.fn(() => true),
}));

const { updateSlider } = await import('./changes.js');

function createFill() {
    const classes = new Set();
    return {
        classList: {
            add: (...names) => names.forEach((name) => classes.add(name)),
            remove: (...names) => names.forEach((name) => classes.delete(name)),
            contains: (name) => classes.has(name),
        },
        style: { transform: '', setProperty: () => {}, removeProperty: () => {} },
    };
}

const state = (value) => ({ state: String(value), attributes: {} });

function createContext(value = 0) {
    const stateObj = state(value);
    return {
        config: { entity: 'input_number.test' },
        _hass: { states: { 'input_number.test': stateObj } },
        elements: { rangeFill: createFill() },
    };
}

beforeEach(() => {
    jest.clearAllMocks();
});

describe('what moves the fill of a slider', () => {
    test('draws it on the first pass', () => {
        const context = createContext(0);
        updateSlider(context);
        expect(setRangeFillTransform).toHaveBeenCalledWith(context, 50);
    });

    // The entity of #2493 is reset to 0 by an automation right after the slide,
    // so it comes back to the value it carried before it. Comparing values read
    // that as nothing to do and the fill stayed under the finger for good.
    test('pulls it back when the entity returns to the value it had before the slide', () => {
        const context = createContext(0);
        updateSlider(context);
        setRangeFillTransform.mockClear();

        // The slide left the fill at 75%, and the entity answers with 0 again.
        context._lastVisualFillPercentage = 75;
        context._hass = { states: { 'input_number.test': state(0) } };
        updateSlider(context);

        expect(setRangeFillTransform).toHaveBeenCalledWith(context, 50);
    });

    test('leaves it under the finger while the state has not moved', () => {
        const context = createContext(0);
        updateSlider(context);
        setRangeFillTransform.mockClear();

        // Same state object, so Home Assistant has not answered yet.
        context._lastVisualFillPercentage = 75;
        updateSlider(context);

        expect(setRangeFillTransform).not.toHaveBeenCalled();
    });

    test('writes nothing when the fill already shows what the entity carries', () => {
        const context = createContext(0);
        updateSlider(context);
        setRangeFillTransform.mockClear();

        // A new state object of the same value, as an attribute change makes one.
        context._hass = { states: { 'input_number.test': state(0) } };
        updateSlider(context);

        expect(setRangeFillTransform).not.toHaveBeenCalled();
    });

    test('follows the entity when it really changed', () => {
        const context = createContext(0);
        updateSlider(context);
        setRangeFillTransform.mockClear();

        context._hass = { states: { 'input_number.test': state(10) } };
        updateSlider(context);

        expect(setRangeFillTransform).toHaveBeenCalledWith(context, 100);
    });

    test('touches nothing while the finger is still down', () => {
        const context = createContext(0);
        context.dragging = true;
        updateSlider(context);
        expect(setRangeFillTransform).not.toHaveBeenCalled();
    });
});
