import { VgExprRef, VgGeoJSONTransform } from '../../vega.schema';
import { UnitModel } from '../unit';
import { DataFlowNode } from './dataflow';
export declare class GeoJSONNode extends DataFlowNode {
    private fields?;
    private geojson?;
    private signal?;
    clone(): GeoJSONNode;
    static parseAll(parent: DataFlowNode, model: UnitModel): DataFlowNode;
    constructor(parent: DataFlowNode, fields?: (string | VgExprRef)[], geojson?: string, signal?: string);
    dependentFields(): Set<string>;
    producedFields(): Set<string>;
    hash(): string;
    assemble(): VgGeoJSONTransform;
}
//# sourceMappingURL=geojson.d.ts.map