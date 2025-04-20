declare module "cytoscape-dagre" {
  import cytoscape from "cytoscape";

  export interface DagreLayoutOptions extends cytoscape.LayoutOptions {
    name: "dagre";
    rankDir?: "TB" | "LR" | "BT" | "RL";
    align?: "UL" | "UR" | "DL" | "DR" | undefined;
    acyclicer?: "greedy" | undefined;
    ranker?: "network-simplex" | "tight-tree" | "longest-path";
    minLen?: (edge: cytoscape.EdgeSingular) => number;
    edgeWeight?: (edge: cytoscape.EdgeSingular) => number;
    nodeDimensionsIncludeLabels?: boolean;
    spacingFactor?: number;
    rankSep?: number;
    nodeSep?: number;
    edgeSep?: number;
    animate?: boolean;
    animationDuration?: number;
    animationEasing?: string;
    padding?: number;
    fit?: boolean;
    boundingBox?: cytoscape.BoundingBox12 | cytoscape.BoundingBoxWH;
  }

  const ext: cytoscape.Ext;
  export default ext;
}
