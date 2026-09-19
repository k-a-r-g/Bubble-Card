export function hasButtonConfig(config, index) {
    return Boolean(config?.[`${index}_link`]) || config?.[`${index}_button_action`] !== undefined;
}

export function getConfiguredButtonIndexes(config) {
    const indexes = new Set();

    Object.keys(config || {}).forEach((key) => {
        const match = key.match(/^(\d+)_(?:link|button_action)$/);
        if (match) {
            const index = Number(match[1]);
            if (hasButtonConfig(config, index)) {
                indexes.add(index);
            }
        }
    });

    return [...indexes].sort((a, b) => a - b);
}

export function getLastConfiguredButtonIndex(config) {
    const indexes = getConfiguredButtonIndexes(config);
    return indexes[indexes.length - 1] ?? 0;
}
