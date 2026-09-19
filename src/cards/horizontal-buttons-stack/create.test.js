import { beforeEach, describe, expect, jest, test } from '@jest/globals';

function createMockClassList(initialClasses = []) {
    const classes = new Set(initialClasses);

    return {
        add: (...names) => names.forEach((name) => classes.add(name)),
        remove: (...names) => names.forEach((name) => classes.delete(name)),
        contains: (name) => classes.has(name),
        toggle: (name, force) => {
            const shouldAdd = force === undefined ? !classes.has(name) : force;
            if (shouldAdd) {
                classes.add(name);
            } else {
                classes.delete(name);
            }
            return classes.has(name);
        },
    };
}

function createMockElement(tag = 'div', classNames = '') {
    return {
        tagName: tag.toUpperCase(),
        children: [],
        listeners: {},
        style: {},
        classList: createMockClassList(classNames ? classNames.split(' ') : []),
        appendChild(child) {
            this.children.push(child);
            return child;
        },
        addEventListener(type, handler) {
            if (!this.listeners[type]) {
                this.listeners[type] = [];
            }
            this.listeners[type].push(handler);
        },
    };
}

const createElement = jest.fn((tag, classNames = '') => createMockElement(tag, classNames));
const forwardHaptic = jest.fn();
const navigate = jest.fn();
const addHash = jest.fn();
const removeHash = jest.fn();
const addActions = jest.fn();

jest.unstable_mockModule('./styles.css', () => ({
    default: '',
}));

jest.unstable_mockModule('../../tools/utils.js', () => ({
    createElement,
    forwardHaptic,
    navigate,
}));

jest.unstable_mockModule('../pop-up/helpers.js', () => ({
    addHash,
    removeHash,
}));

jest.unstable_mockModule('../../tools/tap-actions.js', () => ({
    addActions,
}));

const startContentInsetSync = jest.fn();
jest.unstable_mockModule('../../tools/content-inset.js', () => ({
    startContentInsetSync,
}));

const { createButton } = await import('./create.js');

function buildContext(link) {
    return {
        config: {
            '1_name': 'Kitchen',
            '1_icon': 'mdi:home',
            '1_link': link,
        },
        elements: {
            buttons: [],
            cardContainer: createMockElement('div'),
        },
    };
}

function buildActionContext(buttonAction, link) {
    const context = buildContext(link);
    if (link === undefined) {
        delete context.config['1_link'];
    }
    context.config['1_entity'] = 'light.kitchen';
    context.config['1_button_action'] = buttonAction;
    return context;
}

function clickButton(button) {
    for (const listener of button.listeners.click || []) {
        listener();
    }
}

describe('horizontal buttons stack navigation', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        global.localStorage = {
            getItem: jest.fn(() => null),
            setItem: jest.fn(),
        };
        global.location = {
            hash: '',
            pathname: '/dashboard',
        };
        global.window = {
            addEventListener: jest.fn(),
            location: global.location,
        };
    });

    test('navigates to a Lovelace path without turning it into a hash', () => {
        const context = buildContext('/lovelace/');
        const button = createButton(context, 1);

        clickButton(button);

        expect(navigate).toHaveBeenCalledWith(button, '/lovelace/');
        expect(addHash).not.toHaveBeenCalled();
        expect(removeHash).not.toHaveBeenCalled();
        expect(forwardHaptic).toHaveBeenCalledWith('light');
    });

    test('keeps popup hash links on the popup hash flow', () => {
        const context = buildContext('#kitchen');
        const button = createButton(context, 1);

        clickButton(button);

        expect(addHash).toHaveBeenCalledWith('#kitchen');
        expect(navigate).not.toHaveBeenCalled();
        expect(forwardHaptic).toHaveBeenCalledWith('light');
    });

    test('uses the current button link after a live config change', () => {
        const context = buildContext('#kitchen');
        const button = createButton(context, 1);
        button.link = '/lovelace/';

        clickButton(button);

        expect(navigate).toHaveBeenCalledWith(button, '/lovelace/');
        expect(addHash).not.toHaveBeenCalled();
    });

    test('uses the shared action machinery for an action-only button', () => {
        const action = {
            tap_action: { action: 'toggle' },
            hold_action: { action: 'more-info' },
            double_tap_action: { action: 'none' },
        };
        const context = buildActionContext(action);

        const button = createButton(context, 1);
        clickButton(button);

        expect(addActions).toHaveBeenCalledWith(button, action, 'light.kitchen');
        expect(button.storageKey).toBe('button-1');
        expect(navigate).not.toHaveBeenCalled();
        expect(addHash).not.toHaveBeenCalled();
        expect(removeHash).not.toHaveBeenCalled();
    });

    test('prefers button actions and keeps the link only as fallback', () => {
        const action = { tap_action: { action: 'toggle' } };
        const context = buildActionContext(action, '#kitchen');

        const button = createButton(context, 1);
        clickButton(button);

        expect(addActions).toHaveBeenCalledWith(button, action, 'light.kitchen');
        expect(addHash).not.toHaveBeenCalled();
        expect(button.storageKey).toBe('#kitchen');
    });
});
