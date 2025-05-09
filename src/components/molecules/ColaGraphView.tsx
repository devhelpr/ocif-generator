import React, { useMemo } from "react";
import { OCIFJson } from "../../services/svg-ocif-types/ocif";
import ForceGraph2D from "react-force-graph-2d";

interface ColaGraphViewProps {
  ocif: OCIFJson;
}

interface GraphNode {
  id: string;
  name: string;
  val: number;
  color?: string;
}

interface GraphLink {
  source: string;
  target: string;
}

export const ColaGraphView: React.FC<ColaGraphViewProps> = ({ ocif }) => {
  const graphData = useMemo(() => {
    const nodes: GraphNode[] = Object.entries(ocif.nodes || {}).map(
      ([id, node]) => ({
        id,
        name: id,
        val: 1,
        color: node.data?.[0]?.fillColor || "#4a90e2",
      })
    );

    const links: GraphLink[] = (ocif.relations || []).flatMap((relation) => {
      const sourceNode = relation.data[0]?.start;
      const targetNode = relation.data[0]?.end;

      if (sourceNode && targetNode) {
        return [
          {
            source: sourceNode,
            target: targetNode,
          },
        ];
      }
      return [];
    });

    return { nodes, links };
  }, [ocif]);

  return (
    <div className="w-full h-[600px] border rounded-lg">
      <ForceGraph2D
        graphData={graphData}
        nodeLabel="name"
        nodeColor="color"
        nodeRelSize={8}
        linkWidth={1}
        linkColor={() => "#999"}
        backgroundColor="#ffffff"
        width={800}
        height={600}
        cooldownTicks={100}
        onEngineStop={() => {
          // Optional: Handle simulation stop
        }}
      />
    </div>
  );
};
