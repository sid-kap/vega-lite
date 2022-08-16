var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
import { isObject } from 'vega-util';
import { getAncestorLevel } from '../channeldef';
import { normalizeEncoding, pathGroupingFields } from '../encoding';
import { isMarkDef } from '../mark';
import { isUnitSpec } from '../spec/unit';
import { stack } from '../stack';
import { keys, omit, pick } from '../util';
function dropLineAndPoint(markDef) {
    const { point: _point, line: _line } = markDef, mark = __rest(markDef, ["point", "line"]);
    return keys(mark).length > 1 ? mark : mark.type;
}
function dropLineAndPointFromConfig(config) {
    for (const mark of ['line', 'area', 'rule', 'trail']) {
        if (config[mark]) {
            config = Object.assign(Object.assign({}, config), { 
                // TODO: remove as any
                [mark]: omit(config[mark], ['point', 'line']) });
        }
    }
    return config;
}
function getPointOverlay(markDef, markConfig = {}, encoding) {
    if (markDef.point === 'transparent' ||
        // if the main mark is a single line/trail/area chart, create an invisible point overlay for label.
        (!markDef.point && encoding.label && pathGroupingFields(markDef.type, encoding).length <= 0)) {
        return { opacity: 0 };
    }
    else if (markDef.point) {
        // truthy : true or object
        return isObject(markDef.point) ? markDef.point : {};
    }
    else if (markDef.point !== undefined) {
        // false or null
        return null;
    }
    else {
        // undefined (not disabled)
        if (markConfig.point || encoding.shape) {
            // enable point overlay if config[mark].point is truthy or if encoding.shape is provided
            return isObject(markConfig.point) ? markConfig.point : {};
        }
        // markDef.point is defined as falsy
        return undefined;
    }
}
function getLineOverlay(markDef, markConfig = {}) {
    if (markDef.line) {
        // true or object
        return markDef.line === true ? {} : markDef.line;
    }
    else if (markDef.line !== undefined) {
        // false or null
        return null;
    }
    else {
        // undefined (not disabled)
        if (markConfig.line) {
            // enable line overlay if config[mark].line is truthy
            return markConfig.line === true ? {} : markConfig.line;
        }
        // markDef.point is defined as falsy
        return undefined;
    }
}
function incrementAvoidLevel(labelDef) {
    const ancestorLevel = getAncestorLevel(labelDef.avoid);
    return Object.assign(Object.assign({}, labelDef), { avoid: { ancestor: ancestorLevel + 1 } });
}
export class PathOverlayNormalizer {
    constructor() {
        this.name = 'path-overlay';
    }
    hasMatchingType(spec, config) {
        if (isUnitSpec(spec)) {
            const { mark, encoding } = spec;
            const markDef = isMarkDef(mark) ? mark : { type: mark };
            switch (markDef.type) {
                case 'line':
                case 'rule':
                case 'trail':
                    return !!getPointOverlay(markDef, config[markDef.type], encoding);
                case 'area':
                    return (
                    // false / null are also included as we want to remove the properties
                    !!getPointOverlay(markDef, config[markDef.type], encoding) ||
                        !!getLineOverlay(markDef, config[markDef.type]));
            }
        }
        return false;
    }
    run(spec, normParams, normalize) {
        const { config } = normParams;
        const { params, projection, mark, encoding: e } = spec, outerSpec = __rest(spec, ["params", "projection", "mark", "encoding"]);
        // Need to call normalizeEncoding because we need the inferred types to correctly determine stack
        const encoding = normalizeEncoding(e, config);
        if (encoding.label) {
            encoding.label = incrementAvoidLevel(encoding.label);
        }
        const markDef = isMarkDef(mark) ? mark : { type: mark };
        const pointOverlay = getPointOverlay(markDef, config[markDef.type], encoding);
        const lineOverlay = markDef.type === 'area' && getLineOverlay(markDef, config[markDef.type]);
        const isMultiSeriesPath = pathGroupingFields(markDef.type, spec.encoding).length > 0;
        const layer = [
            Object.assign(Object.assign({}, (params ? { params } : {})), { mark: dropLineAndPoint(Object.assign(Object.assign({}, (markDef.type === 'area' && markDef.opacity === undefined && markDef.fillOpacity === undefined
                    ? { opacity: 0.7 }
                    : {})), markDef)), 
                // drop shape from encoding as this might be used to trigger point overlay
                // If the main mark is multi-series line/trail or stacked area, label the main mark.
                encoding: omit(encoding, ['shape', ...(isMultiSeriesPath ? [] : ['label'])]) })
        ];
        // FIXME: determine rules for applying selections.
        // Need to copy stack config to overlayed layer
        const stackProps = stack(markDef, encoding);
        let overlayEncoding = encoding;
        if (stackProps) {
            const { fieldChannel: stackFieldChannel, offset } = stackProps;
            overlayEncoding = Object.assign(Object.assign({}, encoding), { [stackFieldChannel]: Object.assign(Object.assign({}, encoding[stackFieldChannel]), (offset ? { stack: offset } : {})) });
        }
        if (lineOverlay) {
            layer.push(Object.assign(Object.assign({}, (projection ? { projection } : {})), { mark: Object.assign(Object.assign({ type: 'line' }, pick(markDef, ['clip', 'interpolate', 'tension', 'tooltip'])), lineOverlay), 
                // Drop label. Only add label to the area mark for stacked area chart.
                // Or, only add label to the point overlay for single area chart.
                encoding: omit(overlayEncoding, ['label']) }));
        }
        if (pointOverlay) {
            layer.push(Object.assign(Object.assign({}, (projection ? { projection } : {})), { mark: Object.assign(Object.assign({ type: 'point', opacity: 1, filled: true }, pick(markDef, ['clip', 'tooltip'])), pointOverlay), 
                // If the main mark is a single line/trail/area chart, label the point overlay instead of the main mark.
                encoding: omit(overlayEncoding, isMultiSeriesPath ? ['label'] : []) }));
        }
        return normalize(Object.assign(Object.assign({}, outerSpec), { layer }), Object.assign(Object.assign({}, normParams), { config: dropLineAndPointFromConfig(config) }));
    }
}
//# sourceMappingURL=pathoverlay.js.map