import React, { useMemo } from "react";
import { OCIFJson } from "../../services/svg-ocif-types/ocif";
import ForceGraph2D from "react-force-graph-2d";

interface ColaGraphViewProps {
  ocif: OCIFJson;
}

interface GraphNode {
  id: string;
  name: string;
  val?: number;
  color?: string;
  x?: number;
  y?: number;
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
        nodeCanvasObject={(
          node: GraphNode,
          ctx: CanvasRenderingContext2D,
          globalScale: number
        ) => {
          const label = node.name;
          const fontSize = 12 / globalScale;
          ctx.font = `${fontSize}px Sans-Serif`;
          const textWidth = ctx.measureText(label).width;
          const bckgDimensions = [textWidth, fontSize].map(
            (n) => n + fontSize * 0.2
          );

          // Draw node circle
          ctx.beginPath();
          ctx.arc(node.x || 0, node.y || 0, 8, 0, 2 * Math.PI);
          ctx.fillStyle = node.color || "#4a90e2";
          ctx.fill();
          ctx.strokeStyle = "#2171c7";
          ctx.lineWidth = 2;
          ctx.stroke();

          // Draw text background
          ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
          ctx.fillRect(
            (node.x || 0) - bckgDimensions[0] / 2,
            (node.y || 0) + 10,
            bckgDimensions[0],
            bckgDimensions[1]
          );

          // Draw text
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillStyle = "#333";
          ctx.fillText(
            label,
            node.x || 0,
            (node.y || 0) + 10 + bckgDimensions[1] / 2
          );
        }}
        onEngineStop={() => {
          // Optional: Handle simulation stop
        }}
      />
    </div>
  );
};
