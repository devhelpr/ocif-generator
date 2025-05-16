declare module "cytoscape-elk" {
  import cytoscape from "cytoscape";

  export interface ElkLayoutOptions extends cytoscape.LayoutOptions {
    name: "elk";
    nodeDimensionsIncludeLabels?: boolean;
    elk?: {
      algorithm?: string;
      direction?: "UP" | "DOWN" | "LEFT" | "RIGHT";
      "elk.direction"?: "UP" | "DOWN" | "LEFT" | "RIGHT";
      "elk.padding"?: string | number;
      "elk.separateConnectedComponents"?: boolean;
      "elk.spacing.nodeNode"?: number;
      "elk.layered.crossingMinimization.strategy"?: string;
      "elk.layered.nodePlacement.strategy"?: string;
      "elk.layered.spacing.edgeNodeBetweenLayers"?: number;
      "elk.layered.spacing.baseValue"?: number;
      "elk.layered.spacing.edgeEdgeBetweenLayers"?: number;
      "elk.layered.spacing.edgeNodeBetweenLayers"?: number;
      "elk.layered.spacing.nodeNodeBetweenLayers"?: number;
      feedbackEdges?: boolean;
      "elk.layered.nodePlacement.bk.fixedAlignment"?: string;
      "elk.edgeRouting"?: "ORTHOGONAL" | "POLYLINE" | "SPLINES";
    };
  }

  const ext: cytoscape.Ext;
  export default ext;
}
