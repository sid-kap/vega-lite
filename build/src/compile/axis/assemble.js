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
import { array, isArray } from 'vega-util';
import { AXIS_PARTS, AXIS_PROPERTY_TYPE, CONDITIONAL_AXIS_PROP_INDEX, isConditionalAxisValue } from '../../axis';
import { POSITION_SCALE_CHANNELS } from '../../channel';
import { defaultTitle } from '../../channeldef';
import { isText } from '../../title';
import { contains, getFirstDefined, isEmpty, replaceAll } from '../../util';
import { isSignalRef } from '../../vega.schema';
import { exprFromValueRefOrSignalRef } from '../common';
import { expression } from '../predicate';
function assembleTitle(title, config) {
    if (!title) {
        return undefined;
    }
    if (isArray(title) && !isText(title)) {
        return title.map(fieldDef => defaultTitle(fieldDef, config)).join(', ');
    }
    return title;
}
function setAxisEncode(axis, part, vgProp, vgRef) {
    var _a, _b, _c;
    var _d, _e;
    (_a = axis.encode) !== null && _a !== void 0 ? _a : (axis.encode = {});
    (_b = (_d = axis.encode)[part]) !== null && _b !== void 0 ? _b : (_d[part] = {});
    (_c = (_e = axis.encode[part]).update) !== null && _c !== void 0 ? _c : (_e.update = {});
    // TODO: remove as any after https://github.com/prisma/nexus-prisma/issues/291
    axis.encode[part].update[vgProp] = vgRef;
}
export function assembleAxis(axisCmpt, kind, config, opt = { header: false }) {
    var _a, _b;
    const _c = axisCmpt.combine(), { disable, orient, scale, labelExpr, title, zindex } = _c, axis = __rest(_c, ["disable", "orient", "scale", "labelExpr", "title", "zindex"]);
    if (disable) {
        return undefined;
    }
    for (const prop in axis) {
        const propType = AXIS_PROPERTY_TYPE[prop];
        const propValue = axis[prop];
        if (propType && propType !== kind && propType !== 'both') {
            // Remove properties that are not valid for this kind of axis
            delete axis[prop];
        }
        else if (isConditionalAxisValue(propValue)) {
            // deal with conditional axis value
            const { condition } = propValue, valueOrSignalRef = __rest(propValue, ["condition"]);
            const conditions = array(condition);
            const propIndex = CONDITIONAL_AXIS_PROP_INDEX[prop];
            if (propIndex) {
                const { vgProp, part } = propIndex;
                // If there is a corresponding Vega property for the channel,
                // use Vega's custom axis encoding and delete the original axis property to avoid conflicts
                const vgRef = [
                    ...conditions.map(c => {
                        const { test } = c, valueOrSignalCRef = __rest(c, ["test"]);
                        return Object.assign({ test: expression(null, test) }, valueOrSignalCRef);
                    }),
                    valueOrSignalRef
                ];
                setAxisEncode(axis, part, vgProp, vgRef);
                delete axis[prop];
            }
            else if (propIndex === null) {
                // If propIndex is null, this means we support conditional axis property by converting the condition to signal instead.
                const signalRef = {
                    signal: conditions
                        .map(c => {
                        const { test } = c, valueOrSignalCRef = __rest(c, ["test"]);
                        return `${expression(null, test)} ? ${exprFromValueRefOrSignalRef(valueOrSignalCRef)} : `;
                    })
                        .join('') + exprFromValueRefOrSignalRef(valueOrSignalRef)
                };
                axis[prop] = signalRef;
            }
        }
        else if (isSignalRef(propValue)) {
            const propIndex = CONDITIONAL_AXIS_PROP_INDEX[prop];
            if (propIndex) {
                const { vgProp, part } = propIndex;
                setAxisEncode(axis, part, vgProp, propValue);
                delete axis[prop];
            } // else do nothing since the property already supports signal
        }
        // Do not pass labelAlign/Baseline = null to Vega since it won't pass the schema
        // Note that we need to use null so the default labelAlign is preserved.
        if (contains(['labelAlign', 'labelBaseline'], prop) && axis[prop] === null) {
            delete axis[prop];
        }
    }
    if (kind === 'grid') {
        if (!axis.grid) {
            return undefined;
        }
        // Remove unnecessary encode block
        if (axis.encode) {
            // Only need to keep encode block for grid
            const { grid } = axis.encode;
            axis.encode = Object.assign({}, (grid ? { grid } : {}));
            if (isEmpty(axis.encode)) {
                delete axis.encode;
            }
        }
        return Object.assign(Object.assign({ scale,
            orient }, axis), { domain: false, labels: false, aria: false, 
            // Always set min/maxExtent to 0 to ensure that `config.axis*.minExtent` and `config.axis*.maxExtent`
            // would not affect gridAxis
            maxExtent: 0, minExtent: 0, ticks: false, zindex: getFirstDefined(zindex, 0) // put grid behind marks by default
         });
    }
    else {
        // kind === 'main'
        if (!opt.header && axisCmpt.mainExtracted) {
            // if mainExtracted has been extracted to a separate facet
            return undefined;
        }
        if (labelExpr !== undefined) {
            let expr = labelExpr;
            if (((_b = (_a = axis.encode) === null || _a === void 0 ? void 0 : _a.labels) === null || _b === void 0 ? void 0 : _b.update) && isSignalRef(axis.encode.labels.update.text)) {
                expr = replaceAll(labelExpr, 'datum.label', axis.encode.labels.update.text.signal);
            }
            setAxisEncode(axis, 'labels', 'text', { signal: expr });
        }
        if (axis.labelAlign === null) {
            delete axis.labelAlign;
        }
        // Remove unnecessary encode block
        if (axis.encode) {
            for (const part of AXIS_PARTS) {
                if (!axisCmpt.hasAxisPart(part)) {
                    delete axis.encode[part];
                }
            }
            if (isEmpty(axis.encode)) {
                delete axis.encode;
            }
        }
        const titleString = assembleTitle(title, config);
        return Object.assign(Object.assign(Object.assign(Object.assign({ scale,
            orient, grid: false }, (titleString ? { title: titleString } : {})), axis), (config.aria === false ? { aria: false } : {})), { zindex: getFirstDefined(zindex, 0) // put axis line above marks by default
         });
    }
}
/**
 * Add axis signals so grid line works correctly
 * (Fix https://github.com/vega/vega-lite/issues/4226)
 */
export function assembleAxisSignals(model) {
    const { axes } = model.component;
    const signals = [];
    for (const channel of POSITION_SCALE_CHANNELS) {
        if (axes[channel]) {
            for (const axis of axes[channel]) {
                if (!axis.get('disable') && !axis.get('gridScale')) {
                    // If there is x-axis but no y-scale for gridScale, need to set height/width so x-axis can draw the grid with the right height. Same for y-axis and width.
                    const sizeType = channel === 'x' ? 'height' : 'width';
                    const update = model.getSizeSignalRef(sizeType).signal;
                    if (sizeType !== update) {
                        signals.push({
                            name: sizeType,
                            update
                        });
                    }
                }
            }
        }
    }
    return signals;
}
export function assembleAxes(axisComponents, config) {
    const { x = [], y = [] } = axisComponents;
    return [
        ...x.map(a => assembleAxis(a, 'grid', config)),
        ...y.map(a => assembleAxis(a, 'grid', config)),
        ...x.map(a => assembleAxis(a, 'main', config)),
        ...y.map(a => assembleAxis(a, 'main', config))
    ].filter(a => a); // filter undefined
}
//# sourceMappingURL=assemble.js.map