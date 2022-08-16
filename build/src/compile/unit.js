import { isArray } from 'vega-util';
import { isConditionalAxisValue } from '../axis';
import { GEOPOSITION_CHANNELS, NONPOSITION_SCALE_CHANNELS, POSITION_SCALE_CHANNELS, SCALE_CHANNELS, supportLegend, X, Y } from '../channel';
import { getAncestorLevel, getFieldDef, getFieldOrDatumDef, isFieldOrDatumDef, isTypedFieldDef } from '../channeldef';
import { isGraticuleGenerator } from '../data';
import * as vlEncoding from '../encoding';
import { initEncoding } from '../encoding';
import { replaceExprRef } from '../expr';
import { GEOSHAPE, isMarkDef } from '../mark';
import { isSelectionParameter } from '../selection';
import { isFrameMixins } from '../spec/base';
import { stack } from '../stack';
import { keys, unique } from '../util';
import { assembleAxisSignals } from './axis/assemble';
import { parseUnitAxes } from './axis/parse';
import { signalOrValueRefWithCondition, signalRefOrValue } from './common';
import { parseData } from './data/parse';
import { assembleLayoutSignals } from './layoutsize/assemble';
import { initLayoutSize } from './layoutsize/init';
import { parseUnitLayoutSize } from './layoutsize/parse';
import { defaultFilled, initMarkdef } from './mark/init';
import { isLabelMark, parseMarkGroupsAndLabels } from './mark/mark';
import { isLayerModel, ModelWithField } from './model';
import { assembleTopLevelSignals, assembleUnitSelectionData, assembleUnitSelectionMarks, assembleUnitSelectionSignals } from './selection/assemble';
import { parseUnitSelection } from './selection/parse';
/**
 * Internal model of Vega-Lite specification for the compiler.
 */
export class UnitModel extends ModelWithField {
    constructor(spec, parent, parentGivenName, parentGivenSize = {}, config) {
        var _a;
        super(spec, 'unit', parent, parentGivenName, config, undefined, isFrameMixins(spec) ? spec.view : undefined);
        this.specifiedScales = {};
        this.specifiedAxes = {};
        this.specifiedLegends = {};
        this.specifiedProjection = {};
        this.selection = [];
        this.children = [];
        const markDef = isMarkDef(spec.mark) ? Object.assign({}, spec.mark) : { type: spec.mark };
        const mark = markDef.type;
        // Need to init filled before other mark properties because encoding depends on filled but other mark properties depend on types inside encoding
        if (markDef.filled === undefined) {
            markDef.filled = defaultFilled(markDef, config, {
                graticule: spec.data && isGraticuleGenerator(spec.data)
            });
        }
        this.originalEncoding = spec.encoding;
        const encoding = (this.encoding = initEncoding(spec.encoding || {}, mark, markDef.filled, config));
        this.markDef = initMarkdef(markDef, encoding, config);
        this.size = initLayoutSize({
            encoding,
            size: isFrameMixins(spec)
                ? Object.assign(Object.assign(Object.assign({}, parentGivenSize), (spec.width ? { width: spec.width } : {})), (spec.height ? { height: spec.height } : {})) : parentGivenSize
        });
        // calculate stack properties
        this.stack = stack(mark, encoding);
        this.specifiedScales = this.initScales(mark, encoding);
        this.specifiedAxes = this.initAxes(encoding);
        this.specifiedLegends = this.initLegends(encoding);
        this.specifiedProjection = spec.projection;
        // Selections will be initialized upon parse.
        this.selection = ((_a = spec.params) !== null && _a !== void 0 ? _a : []).filter(p => isSelectionParameter(p));
    }
    get hasProjection() {
        const { encoding } = this;
        const isGeoShapeMark = this.mark === GEOSHAPE;
        const hasGeoPosition = encoding && GEOPOSITION_CHANNELS.some(channel => isFieldOrDatumDef(encoding[channel]));
        return isGeoShapeMark || hasGeoPosition;
    }
    /**
     * Return specified Vega-Lite scale domain for a particular channel
     * @param channel
     */
    scaleDomain(channel) {
        const scale = this.specifiedScales[channel];
        return scale ? scale.domain : undefined;
    }
    axis(channel) {
        return this.specifiedAxes[channel];
    }
    legend(channel) {
        return this.specifiedLegends[channel];
    }
    initScales(mark, encoding) {
        return SCALE_CHANNELS.reduce((scales, channel) => {
            var _a;
            const fieldOrDatumDef = getFieldOrDatumDef(encoding[channel]);
            if (fieldOrDatumDef) {
                scales[channel] = this.initScale((_a = fieldOrDatumDef.scale) !== null && _a !== void 0 ? _a : {});
            }
            return scales;
        }, {});
    }
    initScale(scale) {
        const { domain, range } = scale;
        // TODO: we could simplify this function if we had a recursive replace function
        const scaleInternal = replaceExprRef(scale);
        if (isArray(domain)) {
            scaleInternal.domain = domain.map(signalRefOrValue);
        }
        if (isArray(range)) {
            scaleInternal.range = range.map(signalRefOrValue);
        }
        return scaleInternal;
    }
    initAxes(encoding) {
        return POSITION_SCALE_CHANNELS.reduce((_axis, channel) => {
            // Position Axis
            // TODO: handle ConditionFieldDef
            const channelDef = encoding[channel];
            if (isFieldOrDatumDef(channelDef) ||
                (channel === X && isFieldOrDatumDef(encoding.x2)) ||
                (channel === Y && isFieldOrDatumDef(encoding.y2))) {
                const axisSpec = isFieldOrDatumDef(channelDef) ? channelDef.axis : undefined;
                _axis[channel] = axisSpec
                    ? this.initAxis(Object.assign({}, axisSpec)) // convert truthy value to object
                    : axisSpec;
            }
            return _axis;
        }, {});
    }
    initAxis(axis) {
        const props = keys(axis);
        const axisInternal = {};
        for (const prop of props) {
            const val = axis[prop];
            axisInternal[prop] = isConditionalAxisValue(val)
                ? signalOrValueRefWithCondition(val)
                : signalRefOrValue(val);
        }
        return axisInternal;
    }
    initLegends(encoding) {
        return NONPOSITION_SCALE_CHANNELS.reduce((_legend, channel) => {
            const fieldOrDatumDef = getFieldOrDatumDef(encoding[channel]);
            if (fieldOrDatumDef && supportLegend(channel)) {
                const legend = fieldOrDatumDef.legend;
                _legend[channel] = legend
                    ? replaceExprRef(legend) // convert truthy value to object
                    : legend;
            }
            return _legend;
        }, {});
    }
    parseData() {
        this.component.data = parseData(this);
    }
    parseLayoutSize() {
        parseUnitLayoutSize(this);
    }
    parseSelections() {
        this.component.selection = parseUnitSelection(this, this.selection);
    }
    parseMarkGroup() {
        var _a;
        const { mark, label } = parseMarkGroupsAndLabels(this);
        this.component.mark = mark;
        this.labelMark = label;
        this.avoidAncestorLevel = getAncestorLevel((_a = this.encoding.label) === null || _a === void 0 ? void 0 : _a.avoid);
    }
    parseAxesAndHeaders() {
        this.component.axes = parseUnitAxes(this);
    }
    assembleSelectionTopLevelSignals(signals) {
        return assembleTopLevelSignals(this, signals);
    }
    assembleSignals() {
        return [...assembleAxisSignals(this), ...assembleUnitSelectionSignals(this, [])];
    }
    assembleSelectionData(data) {
        return assembleUnitSelectionData(this, data);
    }
    assembleLayout() {
        return null;
    }
    assembleLayoutSignals() {
        return assembleLayoutSignals(this);
    }
    assembleMarks() {
        var _a;
        if (this.labelMark) {
            const { transform } = this.labelMark;
            const [l] = transform;
            if ('avoidMarks' in l) {
                l.avoidMarks = unique(l.avoidMarks, m => m);
            }
        }
        let marks = [...((_a = this.component.mark) !== null && _a !== void 0 ? _a : []), ...(this.labelMark ? [this.labelMark] : [])];
        // If this unit is part of a layer, selections should augment
        // all in concert rather than each unit individually. This
        // ensures correct interleaving of clipping and brushed marks.
        if (!this.parent || !isLayerModel(this.parent)) {
            marks = assembleUnitSelectionMarks(this, marks);
        }
        marks = marks.map(this.correctDataNames);
        // move label marks to the top
        return [...marks.filter(mark => !isLabelMark(mark)), ...marks.filter(isLabelMark)];
    }
    assembleGroupStyle() {
        const { style } = this.view || {};
        if (style !== undefined) {
            return style;
        }
        if (this.encoding.x || this.encoding.y) {
            return 'cell';
        }
        else {
            return undefined;
        }
    }
    getMapping() {
        return this.encoding;
    }
    getMarkNames() {
        var _a;
        return ((_a = this.component.mark) !== null && _a !== void 0 ? _a : []).map(m => m.name).filter(name => name);
    }
    getLabelNames() {
        return this.labelMark ? [this.labelMark.name] : [];
    }
    avoidMarks(names, level = 0) {
        var _a;
        if (this.avoidAncestorLevel > level && this.labelMark && names.length) {
            const [labelTransform] = this.labelMark.transform;
            (_a = labelTransform.avoidMarks) !== null && _a !== void 0 ? _a : (labelTransform.avoidMarks = []);
            labelTransform.avoidMarks.push(...names);
        }
    }
    get mark() {
        return this.markDef.type;
    }
    channelHasField(channel) {
        return vlEncoding.channelHasField(this.encoding, channel);
    }
    fieldDef(channel) {
        const channelDef = this.encoding[channel];
        return getFieldDef(channelDef);
    }
    typedFieldDef(channel) {
        const fieldDef = this.fieldDef(channel);
        if (isTypedFieldDef(fieldDef)) {
            return fieldDef;
        }
        return null;
    }
}
//# sourceMappingURL=unit.js.map