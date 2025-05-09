declare module "react-force-graph-2d" {
  import { FC } from "react";

  interface GraphData {
    nodes: Array<{
      id: string;
      name: string;
      val?: number;
      color?: string;
      [key: string]: any;
    }>;
    links: Array<{
      source: string;
      target: string;
      [key: string]: any;
    }>;
  }

  interface ForceGraphProps {
    graphData: GraphData;
    nodeLabel?: string | ((node: any) => string);
    nodeColor?: string | ((node: any) => string);
    nodeRelSize?: number;
    linkWidth?: number | ((link: any) => number);
    linkColor?: string | ((link: any) => string);
    backgroundColor?: string;
    width?: number;
    height?: number;
    cooldownTicks?: number;
    onEngineStop?: () => void;
    [key: string]: any;
  }

  const ForceGraph2D: FC<ForceGraphProps>;
  export default ForceGraph2D;
}
