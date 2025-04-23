import { useCallback, useEffect } from "react";
import ReactFlow, {
  Node,
  Edge,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  useReactFlow,
  ReactFlowProvider,
} from "reactflow";
import "reactflow/dist/style.css";
import { OCIFJson } from "../../services/svg-ocif-types/ocif";
import CustomNode from "./CustomNode";
import { renderMarkdownToSVGText } from "../../services/utils/markdownToSVGText";
import { LayoutType } from "./LayoutOptions";
import dagre from "dagre";

const nodeTypes = {
  default: CustomNode,
  diamond: CustomNode,
  ellipse: CustomNode,
};

interface ReactFlowViewProps {
  ocifData: OCIFJson | null;
  layout: LayoutType;
}

// Helper function to get text from linked resource
const getNodeText = (
  node: NonNullable<OCIFJson["nodes"]>[string],
  resources?: OCIFJson["resources"],
  width?: number,
  height?: number
): string => {
  // First check if there's a direct text property
  if (typeof node.text === "string") return node.text;

  // Then check if there's a resource reference
  if (node.resource && resources) {
    const resource = resources.find((r) => r.id === node.resource);
    if (resource) {
      // Find the first text/plain or text/markdown representation
      const textRep = resource.representations?.find(
        (rep) =>
          rep["mime-type"] === "text/plain" ||
          rep["mime-type"] === "text/markdown" ||
          rep["mime-type"] === "image/svg+xml"
      );
      if (textRep?.location) {
        return textRep.location;
      }
      if (textRep?.content) {
        if (textRep["mime-type"] === "text/markdown") {
          // Convert markdown to plain text (removing HTML tags)
          const html = renderMarkdownToSVGText(textRep.content, width, height);
          return typeof html === "string" ? html : "";
        }
        return textRep.content;
      }
    }
  }

  return "Node";
};

// Layout functions
const getDagreLayout = (nodes: Node[], edges: Edge[]) => {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setGraph({ rankdir: "LR" }); // Set layout direction left to right
  dagreGraph.setDefaultEdgeLabel(() => ({}));

  // Add nodes to the graph
  nodes.forEach((node) => {
    const nodeWidth = node.data?.style?.width || 150;
    const nodeHeight = node.data?.style?.height || 50;
    dagreGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight });
  });

  // Add edges to the graph
  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  // Run the layout
  dagre.layout(dagreGraph);

  // Get the layout results
  return nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    const nodeWidth = node.data?.style?.width || 150;
    const nodeHeight = node.data?.style?.height || 50;

    return {
      ...node,
      position: {
        x: nodeWithPosition.x - nodeWidth / 2,
        y: nodeWithPosition.y - nodeHeight / 2,
      },
    };
  });
};

const getGridLayout = (nodes: Node[]) => {
  const gridSize = 200;
  return nodes.map((node, index) => ({
    ...node,
    position: {
      x: (index % 3) * gridSize,
      y: Math.floor(index / 3) * gridSize,
    },
  }));
};

const getCircularLayout = (nodes: Node[]) => {
  const radius = 200;
  const centerX = 400;
  const centerY = 300;
  const angleStep = (2 * Math.PI) / nodes.length;

  return nodes.map((node, index) => ({
    ...node,
    position: {
      x: centerX + radius * Math.cos(index * angleStep),
      y: centerY + radius * Math.sin(index * angleStep),
    },
  }));
};

const getForceLayout = (nodes: Node[], edges: Edge[]) => {
  // Simple force-directed layout
  const iterations = 100;
  const k = 100; // Spring constant
  const repulsion = 1000; // Repulsion constant

  // Initialize positions
  let positions = nodes.map((node) => ({
    id: node.id,
    x: Math.random() * 800,
    y: Math.random() * 600,
  }));

  for (let i = 0; i < iterations; i++) {
    // Calculate forces
    const forces = positions.map(() => ({ x: 0, y: 0 }));

    // Repulsion between all nodes
    for (let j = 0; j < positions.length; j++) {
      for (let k = j + 1; k < positions.length; k++) {
        const dx = positions[j].x - positions[k].x;
        const dy = positions[j].y - positions[k].y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance > 0) {
          const force = repulsion / (distance * distance);
          forces[j].x += (dx / distance) * force;
          forces[j].y += (dy / distance) * force;
          forces[k].x -= (dx / distance) * force;
          forces[k].y -= (dy / distance) * force;
        }
      }
    }

    // Attraction along edges
    edges.forEach((edge) => {
      const sourceIndex = positions.findIndex((p) => p.id === edge.source);
      const targetIndex = positions.findIndex((p) => p.id === edge.target);
      if (sourceIndex !== -1 && targetIndex !== -1) {
        const dx = positions[sourceIndex].x - positions[targetIndex].x;
        const dy = positions[sourceIndex].y - positions[targetIndex].y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance > 0) {
          const force = k * (distance - 100); // Target distance of 100
          forces[sourceIndex].x -= (dx / distance) * force;
          forces[sourceIndex].y -= (dy / distance) * force;
          forces[targetIndex].x += (dx / distance) * force;
          forces[targetIndex].y += (dy / distance) * force;
        }
      }
    });

    // Update positions
    positions = positions.map((pos, index) => ({
      ...pos,
      x: pos.x + forces[index].x * 0.1,
      y: pos.y + forces[index].y * 0.1,
    }));
  }

  return nodes.map((node, index) => ({
    ...node,
    position: {
      x: positions[index].x,
      y: positions[index].y,
    },
  }));
};

const FlowContent = ({
  ocifData,
  layout,
}: {
  ocifData: OCIFJson | null;
  layout: LayoutType;
}) => {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const { fitView } = useReactFlow();

  const convertToReactFlow = useCallback(() => {
    if (!ocifData?.nodes) return;

    const newNodes: Node[] = [];
    const newEdges: Edge[] = [];

    // Convert OCIF nodes to React Flow nodes
    Object.entries(ocifData.nodes).forEach(([id, node]) => {
      if (node.data?.[0]?.type === "@ocif/node/arrow") return;

      const nodeData = node.data?.[0];
      const position = node.position || [0, 0];
      const size = node.size || [120, 60];

      // Determine node type based on OCIF data
      let type = "default";
      if (nodeData?.type === "@ocif/node/oval") {
        type = "ellipse";
      } else if (nodeData?.type === "@ocif/node/diamond") {
        type = "diamond";
      }

      newNodes.push({
        id,
        type,
        position: { x: position[0], y: position[1] },
        data: {
          label: getNodeText(node, ocifData.resources, size[0], size[1]),
          style: {
            width: size[0],
            height: size[1],
            backgroundColor: nodeData?.fillColor || "#f8fafc",
            borderColor: nodeData?.strokeColor || "#64748b",
            borderWidth: nodeData?.strokeWidth || 2,
          },
        },
        connectable: false,
        selectable: true,
      });
    });

    // Convert OCIF relations to React Flow edges
    ocifData.relations?.forEach((relationGroup) => {
      relationGroup.data.forEach((relation) => {
        if (
          relation.type === "@ocif/rel/edge" &&
          relation.start &&
          relation.end
        ) {
          newEdges.push({
            id: relationGroup.id,
            source: relation.start,
            target: relation.end,
            type: "smoothstep",
            animated: true,
            style: { stroke: "#94a3b8", strokeWidth: 2 },
            interactionWidth: 0,
          });
        }
      });
    });

    // Apply layout
    let layoutedNodes = newNodes;
    switch (layout) {
      case "dagre":
        layoutedNodes = getDagreLayout(newNodes, newEdges);
        break;
      case "grid":
        layoutedNodes = getGridLayout(newNodes);
        break;
      case "circular":
        layoutedNodes = getCircularLayout(newNodes);
        break;
      case "force":
        layoutedNodes = getForceLayout(newNodes, newEdges);
        break;
    }

    setNodes(layoutedNodes);
    setEdges(newEdges);
  }, [ocifData, setNodes, setEdges, layout]);

  // Update React Flow nodes and edges when OCIF data changes
  useEffect(() => {
    convertToReactFlow();
  }, [convertToReactFlow]);

  // Fit view after layout changes
  useEffect(() => {
    setTimeout(() => {
      fitView({ padding: 0.2 });
    }, 100);
  }, [layout, fitView]);

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      nodeTypes={nodeTypes}
      fitView
      nodesDraggable={true}
      nodesConnectable={false}
      elementsSelectable={true}
      panOnScroll={true}
      zoomOnScroll={true}
      panOnDrag={true}
      defaultViewport={{ x: 0, y: 0, zoom: 1 }}
      minZoom={0.1}
      maxZoom={2}
      style={{ background: "#f8fafc" }}
      nodeOrigin={[0.5, 0.5]}
    >
      <Background />
      <Controls />
      <MiniMap />
    </ReactFlow>
  );
};

export function ReactFlowView({ ocifData, layout }: ReactFlowViewProps) {
  return (
    <div style={{ width: "100%", height: "100%", minHeight: "500px" }}>
      <ReactFlowProvider>
        <FlowContent ocifData={ocifData} layout={layout} />
      </ReactFlowProvider>
    </div>
  );
}
