import { isColorCloseToWhite } from "../../tools/style.js";
import { createElement, isDocumentRTL } from "../../tools/utils.js";
import { createButton } from './create.js';
import { resolveTemplate } from "../../tools/render-template.js";
import { getButtonWidthStorageKey, getStoredButtonWidth, storeButtonWidth } from './button-width-storage.js';
import { getConfiguredButtonIndexes, hasButtonConfig } from './config.js';
import { handleCustomStyles } from '../../tools/style-processor.js';
import { addActions, removeActions } from '../../tools/tap-actions.js';

const BUTTON_MARGIN = 12;

export function sortButtons(context) {
    if (!context.config.auto_order) return;

    const states = context._hass.states;

    context.elements.buttons.sort((a, b) => {
        const aState = states[a.pirSensor];
        const bState = states[b.pirSensor];

        // Two buttons with no sensor to order by are equal, so they keep the
        // order they are configured in, at the end of the row. Answering 1 for
        // both of them said that each one comes after the other, and a
        // comparator that contradicts itself leaves the result up to the sort
        // algorithm. Firefox does not sort with the same one as Chrome, and
        // since this runs on every state update, the row kept reshuffling on
        // Firefox alone (#1431).
        if (!aState && !bState) return 0;

        // A button with no sensor goes after one that has a reading
        if (!aState) return 1;
        if (!bState) return -1;

        // If only one PIR sensor is "on", it comes first
        if (aState.state === "on" && bState.state !== "on") return -1;
        if (bState.state === "on" && aState.state !== "on") return 1;

        // Otherwise the most recently updated comes first, on or off alike.
        // Missing timestamps compare equal so they cannot contradict either.
        const aTime = aState.last_updated ?? '';
        const bTime = bState.last_updated ?? '';
        return aTime > bTime ? -1 : aTime === bTime ? 0 : 1;
    });
}
export function placeButtons(context) {
    let position = 0;
    // Buttons are anchored at the inline start, so in RTL they grow leftward
    const directionFactor = isDocumentRTL() ? -1 : 1;
    for (let i = 0; i < context.elements.buttons.length; ++i) {
        const storageKey = context.elements.buttons[i].storageKey;
        let buttonWidth = getStoredButtonWidth(storageKey);

        context.elements.buttons[i].style.width = '';
        const newWidth = context.elements.buttons[i].offsetWidth;
        context.elements.buttons[i].style.width = `${newWidth}px`;

        if (newWidth > 0) {
          buttonWidth = newWidth;
          storeButtonWidth(storageKey, newWidth);
        }

        if (buttonWidth !== null) {
          context.elements.buttons[i].style.transform = `translateX(${directionFactor * position}px)`;
          context.elements.buttons[i].style.width = '';
          position += +buttonWidth + BUTTON_MARGIN;
        }
    }
    context.elements.cardContainer.style.width = `${position}px`;
}
export function changeEditor(context) {
    // const detectedEditor = context.shadowRoot.host.closest('hui-card-preview, hui-card-options');
    const detectedEditor = context.editor || context.detectedEditor;

    if (detectedEditor) {
        context.elements.cardContainer.classList.add('editor');
        context.card.classList.add('editor');
    } else {
        context.elements.cardContainer.classList.remove('editor');
        context.card.classList.remove('editor');
    }
}
export function changeLight(context) {
    context.elements.buttons.forEach((button) => {
        const entityData = context._hass?.states?.[button.lightEntity];
        const rgbColor = entityData?.attributes.rgb_color;
        const state = entityData?.state;

        // Expose the display state directly to CSS so an icon can react
        // without a JavaScript style template forcing a complete card render.
        button.classList.remove('is-on', 'is-off');
        if (state === 'on') button.classList.add('is-on');
        if (state === 'off') button.classList.add('is-off');

        if (rgbColor) {
            const rgbColorOpacity = (isColorCloseToWhite(rgbColor) ? 'rgba(255, 220, 200, 0.5)' : `rgba(${rgbColor}, 0.5)`);
            button.backgroundColor.style.backgroundColor = rgbColorOpacity;
            button.backgroundColor.style.borderColor = 'rgba(0, 0, 0, 0)';
        } else if (state == 'on') {
            button.backgroundColor.style.backgroundColor = 'rgba(255, 255, 255, 0.5)';
            button.backgroundColor.style.borderColor = 'rgba(0, 0, 0, 0)';
        } else {
            button.backgroundColor.style.backgroundColor = 'rgba(0, 0, 0, 0)';
            button.backgroundColor.style.borderColor = 'var(--primary-text-color)';
        }
    });
}

// Repaint numbered display entities in place. PIR changes additionally use the
// existing ordering/layout path, but ordinary entity changes avoid the forced
// width measurements of a complete horizontal-stack render.
export function refreshHorizontalButtonsState(context, previousHass) {
    if (context.cardType !== 'horizontal-buttons-stack' ||
        !context.elements?.buttons?.length ||
        !previousHass?.states ||
        !context._hass?.states) {
        return false;
    }

    let displayChanged = false;
    let orderChanged = false;

    for (const button of context.elements.buttons) {
        if (button.lightEntity &&
            previousHass.states[button.lightEntity] !== context._hass.states[button.lightEntity]) {
            displayChanged = true;
        }
        if (context.config.auto_order && button.pirSensor &&
            previousHass.states[button.pirSensor] !== context._hass.states[button.pirSensor]) {
            orderChanged = true;
        }
    }

    if (displayChanged) changeLight(context);
    if (orderChanged) {
        sortButtons(context);
        placeButtons(context);
        changeStatus(context);
    }

    return displayChanged || orderChanged;
}
export function changeConfig(context) {
    context.elements.buttons.forEach((button) => {
        const index = button.index;
        const name = resolveTemplate(context, context.config[`${index}_name`]) ?? '';
        const icon = resolveTemplate(context, context.config[`${index}_icon`]) ?? '';
        const sensor = context.config[`${index}_pir_sensor`];
        const link = context.config[`${index}_link`];
        const entity = context.config[`${index}_entity`];
        const buttonAction = context.config[`${index}_button_action`];
        const hadButtonAction = button.buttonAction !== undefined;
        const buttonActionSignature = JSON.stringify({ buttonAction, entity });

        button.pirSensor = sensor;
        button.lightEntity = entity;
        button.link = link;
        button.buttonAction = buttonAction;
        button.storageKey = getButtonWidthStorageKey(link, index);

        if (buttonAction !== undefined) {
            if (button.buttonActionSignature !== buttonActionSignature) {
                if (hadButtonAction) {
                    removeActions(button);
                }
                addActions(button, buttonAction, entity);
            }
        } else if (hadButtonAction) {
            removeActions(button);
            if (!button.haRipple) {
                button.haRipple = createElement('ha-ripple');
                button.appendChild(button.haRipple);
            }
        }
        button.buttonActionSignature = buttonActionSignature;

        if (name) {
            button.name.innerText = name;
            button.name.style.display = '';
        } else {
            button.name.style.display = 'none';
        }
        if (icon) {
            button.icon.icon = icon;
            button.icon.style.display = '';
        } else {
            button.icon.style.display = 'none';
        }

        if (!hasButtonConfig(context.config, index)) {
            button.remove();
            context.elements.buttons = context.elements.buttons.filter((btn) => btn !== button);
            // Renumber by config slot, never by position in the list. index is
            // the slot a button reads its name, icon and link from, while the
            // list order is only what the row shows, and auto_order sorts that
            // order by PIR activity. Numbering by position handed the buttons
            // each other's config as soon as the two diverged.
            [...context.elements.buttons]
                .sort((a, b) => a.index - b.index)
                .forEach((btn, idx) => {
                    btn.index = idx + 1;
                });
        }
    });

    // Create a new button if necessary. Walk every configured index instead of
    // starting past the end of the list: sortButtons reorders that list and the
    // removal above shrinks it, so its length tells us nothing about which
    // index is missing. createButton registers and appends the button itself.
    for (const index of getConfiguredButtonIndexes(context.config)) {
        const existingButton = context.elements.buttons.find(button => button.index === index);
        if (!existingButton) {
            createButton(context, index);
        }
    }
}
export function changeStatus(context) {
    if (context.content.scrollWidth >= context.content.offsetWidth) {
        context.content.classList.add('is-scrollable');
    } else {
        context.content.classList.remove('is-scrollable');
    }
}
export function changeStyle(context) {
    handleCustomStyles(context);
}
