import cytoscape from "cytoscape";

export interface CoseBilkentLayoutOptions extends cytoscape.BaseLayoutOptions {
  name: "cose-bilkent";
  padding?: number;
  animate?: boolean;
  randomize?: boolean;
  componentSpacing?: number;
  nodeRepulsion?: (node: cytoscape.NodeSingular) => number;
  nodeOverlap?: number;
  idealEdgeLength?: (edge: cytoscape.EdgeSingular) => number;
  edgeElasticity?: (edge: cytoscape.EdgeSingular) => number;
  nestingFactor?: number;
  gravity?: number;
  numIter?: number;
  initialTemp?: number;
  coolingFactor?: number;
  minTemp?: number;
  fit?: boolean;
  avoidOverlap?: boolean;
  nodeDimensionsIncludeLabels?: boolean;
}
