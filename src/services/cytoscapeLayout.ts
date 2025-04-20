import cytoscape from "cytoscape";
import dagre from "cytoscape-dagre";
import { DagreLayoutOptions } from "../types/cytoscape-dagre";
// Register the dagre layout
cytoscape.use(dagre);

interface NodeData {
  type: string;
  [key: string]: unknown;
}

interface Node {
  id: string;
  position?: number[];
  size?: number[];
  data?: NodeData[];
  [key: string]: unknown;
}

interface RelationData {
  type: string;
  node?: string;
  start?: string;
  end?: string;
  [key: string]: unknown;
}

interface Relation {
  id: string;
  source?: string;
  target?: string;
  data?: RelationData[];
  [key: string]: unknown;
}

interface OCIFData {
  ocif: string;
  nodes: Node[];
  relations: Relation[];
  resources: unknown[];
  schemas: unknown[];
}

/**
 * Applies Cytoscape layout to OCIF nodes
 * @param ocifData The OCIF data to layout
 * @returns The OCIF data with updated node positions
 */
export function applyCytoscapeLayout(ocifData: OCIFData): OCIFData {
  const nodes = ocifData.nodes;
  const relations = ocifData.relations;

  // Default canvas size
  const width = 1000;
  const height = 800;
  const padding = 50;

  // Create Cytoscape elements
  const cyElements: cytoscape.ElementDefinition[] = [];

  // Add nodes
  nodes.forEach((node) => {
    const isArrow = node.data?.some((data) => data.type === "@ocif/node/arrow");
    const position = node.position || [
      padding + Math.random() * (width - 2 * padding),
      padding + Math.random() * (height - 2 * padding),
    ];
    const defaultSize = isArrow ? [0, 0] : [80, 40];
    const size = node.size || defaultSize;
    if (!isArrow) {
      cyElements.push({
        group: "nodes",
        data: {
          id: node.id,
          isArrow,
          originalData: node,
          width: size[0],
          height: size[1],
        },
        position: {
          x: position[0],
          y: position[1],
        },
      });
    }
  });

  // Add edges
  relations.forEach((relation) => {
    if (relation.source && relation.target) {
      cyElements.push({
        group: "edges",
        data: {
          id: relation.id,
          source: relation.source,
          target: relation.target,
          originalData: relation,
        },
      });
    }
  });

  // Create a proper container element
  const container = document.createElement("div");
  container.style.width = `${width}px`;
  container.style.height = `${height}px`;
  container.style.position = "absolute";
  container.style.left = "0";
  container.style.top = "0";
  container.style.visibility = "hidden";
  document.body.appendChild(container);

  // Create Cytoscape instance
  const cy = cytoscape({
    container: container,
    elements: cyElements,
    style: [
      {
        selector: "node",
        style: {
          width: "data(width)",
          height: "data(height)",
          "background-color": "#666",
          label: "data(id)",
          "text-valign": "center",
          "text-halign": "center",
        },
      },
      {
        selector: "edge",
        style: {
          width: 2,
          "line-color": "#666",
          "target-arrow-color": "#666",
          "target-arrow-shape": "triangle",
          "curve-style": "bezier",
        },
      },
    ],
  });

  // Set viewport dimensions
  cy.viewport({
    zoom: 1,
    pan: { x: 0, y: 0 },
  });

  // Apply dagre layout
  const layoutOptions: DagreLayoutOptions = {
    name: "dagre",
    rankDir: "TB",
    //align: "UL",
    direction: "LR",
    nodeSep: 50,
    edgeSep: 50,
    rankSep: 50,
    ranker: "longest-path",
    padding: padding,
    random: true,
    animate: false,
    fit: false,
    useFixedHeight: true,
    fixedHeight: 800,
  };

  const layout = cy.layout(layoutOptions);

  // Run the layout
  layout.run();

  // Clean up the container
  container.remove();

  // Update original nodes with new positions
  cy.nodes().forEach((cyNode) => {
    const originalNode = cyNode.data("originalData");
    const position = cyNode.position();
    originalNode.position = [position.x, position.y];
  });

  // Position arrow nodes between their connected nodes
  relations.forEach((relation) => {
    const arrowNodeId = relation.data?.find(
      (data) => data.type === "@ocif/rel/edge"
    )?.node;
    if (!arrowNodeId) return;

    const sourceId = relation.data?.find(
      (data) => data.type === "@ocif/rel/edge"
    )?.start;
    const targetId = relation.data?.find(
      (data) => data.type === "@ocif/rel/edge"
    )?.end;

    if (!sourceId || !targetId) return;

    const arrowNode = nodes.find((node) => node.id === arrowNodeId);
    const sourceNode = nodes.find((node) => node.id === sourceId);
    const targetNode = nodes.find((node) => node.id === targetId);

    if (
      !arrowNode ||
      !sourceNode ||
      !targetNode ||
      !sourceNode.position ||
      !targetNode.position
    )
      return;

    // Calculate midpoint between source and target
    const midX = (sourceNode.position[0] + targetNode.position[0]) / 2;
    const midY = (sourceNode.position[1] + targetNode.position[1]) / 2;

    // Update arrow node position
    arrowNode.position = [midX, midY];

    // Update arrow start and end points
    const arrowData = arrowNode.data?.find(
      (data) => data.type === "@ocif/node/arrow"
    );
    if (arrowData) {
      arrowData.start = [sourceNode.position[0], sourceNode.position[1]];
      arrowData.end = [targetNode.position[0], targetNode.position[1]];
    }
  });

  // Normalize positions to ensure all nodes are visible
  const validNodes = nodes.filter(
    (node) =>
      node.position &&
      node.position.length === 2 &&
      !isNaN(node.position[0]) &&
      !isNaN(node.position[1])
  );

  if (validNodes.length === 0) {
    return ocifData;
  }

  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  validNodes.forEach((node) => {
    if (node.position) {
      minX = Math.min(minX, node.position[0]);
      minY = Math.min(minY, node.position[1]);
      maxX = Math.max(maxX, node.position[0]);
      maxY = Math.max(maxY, node.position[1]);
    }
  });

  // Prevent division by zero
  const rangeX = maxX - minX;
  const rangeY = maxY - minY;
  if (rangeX === 0 || rangeY === 0) {
    return ocifData;
  }

  const scaleX = (width - 2 * padding) / rangeX;
  const scaleY = (height - 2 * padding) / rangeY;
  const scale = Math.min(scaleX, scaleY, 1);

  validNodes.forEach((node) => {
    if (node.position) {
      node.position[0] = padding + (node.position[0] - minX) * scale;
      node.position[1] = padding + (node.position[1] - minY) * scale;
    }
  });

  // Update arrow start and end points after normalization
  relations.forEach((relation) => {
    const arrowNodeId = relation.data?.find(
      (data) => data.type === "@ocif/rel/edge"
    )?.node;
    if (!arrowNodeId) return;

    const sourceId = relation.data?.find(
      (data) => data.type === "@ocif/rel/edge"
    )?.start;
    const targetId = relation.data?.find(
      (data) => data.type === "@ocif/rel/edge"
    )?.end;

    if (!sourceId || !targetId) return;

    const arrowNode = nodes.find((node) => node.id === arrowNodeId);
    const sourceNode = nodes.find((node) => node.id === sourceId);
    const targetNode = nodes.find((node) => node.id === targetId);

    if (
      !arrowNode ||
      !sourceNode ||
      !targetNode ||
      !sourceNode.position ||
      !targetNode.position
    )
      return;

    // Update arrow start and end points
    const arrowData = arrowNode.data?.find(
      (data) => data.type === "@ocif/node/arrow"
    );
    if (arrowData) {
      arrowData.start = [sourceNode.position[0], sourceNode.position[1]];
      arrowData.end = [targetNode.position[0], targetNode.position[1]];
    }
  });

  return ocifData;
}
