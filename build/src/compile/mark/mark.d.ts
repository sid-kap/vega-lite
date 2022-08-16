import { LabelTransform, Mark as VGMark, BaseMark, Encodable } from 'vega';
import { VgCompare, VgEncodeEntry } from '../../vega.schema';
import { UnitModel } from '../unit';
export interface LabelMark extends BaseMark, Encodable<VgEncodeEntry> {
    type: 'text';
    transform: [LabelTransform];
}
export declare function isLabelMark(mark: VGMark): boolean;
export declare function parseMarkGroupsAndLabels(model: UnitModel): {
    mark: any[];
    label?: LabelMark;
};
export declare function getSort(model: UnitModel): VgCompare;
export declare function getLabelMark(model: UnitModel, data: string): LabelMark;
//# sourceMappingURL=mark.d.ts.map