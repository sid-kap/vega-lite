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
import { array, stringValue } from 'vega-util';
import { STORE, TUPLE, unitName } from '.';
import { X, Y } from '../../channel';
import { warn } from '../../log';
import { hasContinuousDomain } from '../../scale';
import { keys } from '../../util';
import { assembleInit } from './assemble';
import { TUPLE_FIELDS } from './project';
import scales from './scales';
export const BRUSH = '_brush';
export const SCALE_TRIGGER = '_scale_trigger';
const interval = {
    defined: selCmpt => selCmpt.type === 'interval',
    signals: (model, selCmpt, signals) => {
        const name = selCmpt.name;
        const fieldsSg = name + TUPLE_FIELDS;
        const hasScales = scales.defined(selCmpt);
        const init = selCmpt.init ? selCmpt.init[0] : null;
        const dataSignals = [];
        const scaleTriggers = [];
        if (selCmpt.translate && !hasScales) {
            const filterExpr = `!event.item || event.item.mark.name !== ${stringValue(name + BRUSH)}`;
            events(selCmpt, (on, evt) => {
                var _a;
                var _b;
                const filters = array(((_a = (_b = evt.between[0]).filter) !== null && _a !== void 0 ? _a : (_b.filter = [])));
                if (!filters.includes(filterExpr)) {
                    filters.push(filterExpr);
                }
                return on;
            });
        }
        selCmpt.project.items.forEach((proj, i) => {
            const channel = proj.channel;
            if (channel !== X && channel !== Y) {
                warn('Interval selections only support x and y encoding channels.');
                return;
            }
            const val = init ? init[i] : null;
            const cs = channelSignals(model, selCmpt, proj, val);
            const dname = proj.signals.data;
            const vname = proj.signals.visual;
            const scaleName = stringValue(model.scaleName(channel));
            const scaleType = model.getScaleComponent(channel).get('type');
            const toNum = hasContinuousDomain(scaleType) ? '+' : '';
            signals.push(...cs);
            dataSignals.push(dname);
            scaleTriggers.push({
                scaleName: model.scaleName(channel),
                expr: `(!isArray(${dname}) || ` +
                    `(${toNum}invert(${scaleName}, ${vname})[0] === ${toNum}${dname}[0] && ` +
                    `${toNum}invert(${scaleName}, ${vname})[1] === ${toNum}${dname}[1]))`
            });
        });
        // Proxy scale reactions to ensure that an infinite loop doesn't occur
        // when an interval selection filter touches the scale.
        if (!hasScales && scaleTriggers.length) {
            signals.push({
                name: name + SCALE_TRIGGER,
                value: {},
                on: [
                    {
                        events: scaleTriggers.map(t => ({ scale: t.scaleName })),
                        update: `${scaleTriggers.map(t => t.expr).join(' && ')} ? ${name + SCALE_TRIGGER} : {}`
                    }
                ]
            });
        }
        // Only add an interval to the store if it has valid data extents. Data extents
        // are set to null if pixel extents are equal to account for intervals over
        // ordinal/nominal domains which, when inverted, will still produce a valid datum.
        const update = `unit: ${unitName(model)}, fields: ${fieldsSg}, values`;
        return signals.concat(Object.assign(Object.assign({ name: name + TUPLE }, (init ? { init: `{${update}: ${assembleInit(init)}}` } : {})), (dataSignals.length
            ? {
                on: [
                    {
                        events: [{ signal: dataSignals.join(' || ') }],
                        update: `${dataSignals.join(' && ')} ? {${update}: [${dataSignals}]} : null`
                    }
                ]
            }
            : {})));
    },
    marks: (model, selCmpt, marks) => {
        const name = selCmpt.name;
        const { x, y } = selCmpt.project.hasChannel;
        const xvname = x === null || x === void 0 ? void 0 : x.signals.visual;
        const yvname = y === null || y === void 0 ? void 0 : y.signals.visual;
        const store = `data(${stringValue(selCmpt.name + STORE)})`;
        // Do not add a brush if we're binding to scales
        // or we don't have a valid interval projection
        if (scales.defined(selCmpt) || (!x && !y)) {
            return marks;
        }
        const update = {
            x: x !== undefined ? { signal: `${xvname}[0]` } : { value: 0 },
            y: y !== undefined ? { signal: `${yvname}[0]` } : { value: 0 },
            x2: x !== undefined ? { signal: `${xvname}[1]` } : { field: { group: 'width' } },
            y2: y !== undefined ? { signal: `${yvname}[1]` } : { field: { group: 'height' } }
        };
        // If the selection is resolved to global, only a single interval is in
        // the store. Wrap brush mark's encodings with a production rule to test
        // this based on the `unit` property. Hide the brush mark if it corresponds
        // to a unit different from the one in the store.
        if (selCmpt.resolve === 'global') {
            for (const key of keys(update)) {
                update[key] = [
                    Object.assign({ test: `${store}.length && ${store}[0].unit === ${unitName(model)}` }, update[key]),
                    { value: 0 }
                ];
            }
        }
        // Two brush marks ensure that fill colors and other aesthetic choices do
        // not interefere with the core marks, but that the brushed region can still
        // be interacted with (e.g., dragging it around).
        const _a = selCmpt.mark, { fill, fillOpacity, cursor } = _a, stroke = __rest(_a, ["fill", "fillOpacity", "cursor"]);
        const vgStroke = keys(stroke).reduce((def, k) => {
            def[k] = [
                {
                    test: [x !== undefined && `${xvname}[0] !== ${xvname}[1]`, y !== undefined && `${yvname}[0] !== ${yvname}[1]`]
                        .filter(t => t)
                        .join(' && '),
                    value: stroke[k]
                },
                { value: null }
            ];
            return def;
        }, {});
        return [
            {
                name: `${name + BRUSH}_bg`,
                type: 'rect',
                clip: true,
                encode: {
                    enter: {
                        fill: { value: fill },
                        fillOpacity: { value: fillOpacity }
                    },
                    update
                }
            },
            ...marks,
            {
                name: name + BRUSH,
                type: 'rect',
                clip: true,
                encode: {
                    enter: Object.assign(Object.assign({}, (cursor ? { cursor: { value: cursor } } : {})), { fill: { value: 'transparent' } }),
                    update: Object.assign(Object.assign({}, update), vgStroke)
                }
            }
        ];
    }
};
export default interval;
/**
 * Returns the visual and data signals for an interval selection.
 */
function channelSignals(model, selCmpt, proj, init) {
    const channel = proj.channel;
    const vname = proj.signals.visual;
    const dname = proj.signals.data;
    const hasScales = scales.defined(selCmpt);
    const scaleName = stringValue(model.scaleName(channel));
    const scale = model.getScaleComponent(channel);
    const scaleType = scale ? scale.get('type') : undefined;
    const scaled = (str) => `scale(${scaleName}, ${str})`;
    const size = model.getSizeSignalRef(channel === X ? 'width' : 'height').signal;
    const coord = `${channel}(unit)`;
    const on = events(selCmpt, (def, evt) => {
        return [
            ...def,
            { events: evt.between[0], update: `[${coord}, ${coord}]` },
            { events: evt, update: `[${vname}[0], clamp(${coord}, 0, ${size})]` } // Brush End
        ];
    });
    // React to pan/zooms of continuous scales. Non-continuous scales
    // (band, point) cannot be pan/zoomed and any other changes
    // to their domains (e.g., filtering) should clear the brushes.
    on.push({
        events: { signal: selCmpt.name + SCALE_TRIGGER },
        update: hasContinuousDomain(scaleType) ? `[${scaled(`${dname}[0]`)}, ${scaled(`${dname}[1]`)}]` : `[0, 0]`
    });
    return hasScales
        ? [{ name: dname, on: [] }]
        : [
            Object.assign(Object.assign({ name: vname }, (init ? { init: assembleInit(init, true, scaled) } : { value: [] })), { on }),
            Object.assign(Object.assign({ name: dname }, (init ? { init: assembleInit(init) } : {})), { on: [
                    {
                        events: { signal: vname },
                        update: `${vname}[0] === ${vname}[1] ? null : invert(${scaleName}, ${vname})`
                    }
                ] })
        ];
}
function events(selCmpt, cb) {
    return selCmpt.events.reduce((on, evt) => {
        if (!evt.between) {
            warn(`${evt} is not an ordered event stream for interval selections.`);
            return on;
        }
        return cb(on, evt);
    }, []);
}
//# sourceMappingURL=interval.js.map