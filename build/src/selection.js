import { isObject } from 'vega-util';
export const SELECTION_ID = '_vgsid_';
export const defaultConfig = {
    point: {
        on: 'click',
        fields: [SELECTION_ID],
        toggle: 'event.shiftKey',
        resolve: 'global',
        clear: 'dblclick'
    },
    interval: {
        on: '[mousedown, window:mouseup] > window:mousemove!',
        encodings: ['x', 'y'],
        translate: '[mousedown, window:mouseup] > window:mousemove!',
        zoom: 'wheel!',
        mark: { fill: '#333', fillOpacity: 0.125, stroke: 'white' },
        resolve: 'global',
        clear: 'dblclick'
    }
};
export function isLegendBinding(bind) {
    return bind === 'legend' || !!(bind === null || bind === void 0 ? void 0 : bind.legend);
}
export function isLegendStreamBinding(bind) {
    return isLegendBinding(bind) && isObject(bind);
}
export function isSelectionParameter(param) {
    return !!(param === null || param === void 0 ? void 0 : param['select']);
}
//# sourceMappingURL=selection.js.map