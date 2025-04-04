import * as d3 from 'd3-force';

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

interface D3Node extends d3.SimulationNodeDatum {
  id: string;
  x: number;
  y: number;
  size?: number[];
  isArrow?: boolean;
  originalData: Node;
}

interface D3Link extends d3.SimulationLinkDatum<D3Node> {
  id: string;
  source: D3Node;
  target: D3Node;
  originalData: Relation;
}

/**
 * Applies d3-force layout to OCIF nodes
 * @param ocifData The OCIF data to layout
 * @returns The OCIF data with updated node positions
 */
export function applyD3ForceLayout(ocifData: OCIFData): OCIFData {
  const nodes = ocifData.nodes;
  const relations = ocifData.relations;

  // Default canvas size
  const width = 1000;
  const height = 800;
  const padding = 50;

  // Identify arrow relations
  const arrowRelations = relations.filter(relation => 
    relation.data?.some(data => data.type === '@ocif/rel/edge' && data.node)
  );

  // Create d3 nodes and links
  const d3Nodes: D3Node[] = nodes.map(node => {
    // Check if this is an arrow node
    const isArrow = node.data?.some(data => data.type === '@ocif/node/arrow');
    
    // Initialize position if not set
    const position = node.position || [
      padding + Math.random() * (width - 2 * padding),
      padding + Math.random() * (height - 2 * padding)
    ];
    
    // Use smaller default sizes for non-arrow nodes
    const defaultSize = isArrow ? [0, 0] : [80, 40];
    
    return {
      id: node.id,
      x: position[0],
      y: position[1],
      size: node.size || defaultSize,
      isArrow,
      originalData: node
    };
  });

  // Create links for regular relations
  const regularLinks: D3Link[] = relations
    .filter(relation => 
      relation.source && 
      relation.target && 
      !relation.data?.some(data => data.type === '@ocif/rel/edge' && data.node)
    )
    .map(relation => {
      const source = d3Nodes.find(n => n.id === relation.source);
      const target = d3Nodes.find(n => n.id === relation.target);
      
      if (!source || !target) return null;
      
      return {
        id: relation.id,
        source,
        target,
        originalData: relation
      };
    })
    .filter((link): link is D3Link => link !== null);

  // Create the simulation
  const simulation = d3.forceSimulation<D3Node>(d3Nodes)
    .force('link', d3.forceLink<D3Node, D3Link>(regularLinks)
      .id(d => d.id)
      .distance(200) // Increased distance between connected nodes to make room for arrows
    )
    .force('charge', d3.forceManyBody<D3Node>()
      .strength(d => d.isArrow ? 0 : -500) // Increased repulsion for non-arrow nodes
    )
    .force('center', d3.forceCenter(width / 2, height / 2))
    .force('collision', d3.forceCollide<D3Node>()
      .radius(d => Math.max(d.size?.[0] || 50, d.size?.[1] || 50) / 2 + 20) // Increased collision radius
      .strength(0.8)
    )
    .force('x', d3.forceX(width / 2).strength(0.05))
    .force('y', d3.forceY(height / 2).strength(0.05));

  // Run the simulation for a fixed number of ticks
  for (let i = 0; i < 300; i++) {
    simulation.tick();
  }

  // Stop the simulation
  simulation.stop();

  // Update the original nodes with the new positions
  d3Nodes.forEach(d3Node => {
    const originalNode = d3Node.originalData;
    originalNode.position = [d3Node.x, d3Node.y];
  });

  // Position arrow nodes between their connected nodes
  arrowRelations.forEach(relation => {
    const arrowNodeId = relation.data?.find(data => data.type === '@ocif/rel/edge')?.node;
    if (!arrowNodeId) return;
    
    const sourceId = relation.data?.find(data => data.type === '@ocif/rel/edge')?.start;
    const targetId = relation.data?.find(data => data.type === '@ocif/rel/edge')?.end;
    
    if (!sourceId || !targetId) return;
    
    const arrowNode = nodes.find(node => node.id === arrowNodeId);
    const sourceNode = nodes.find(node => node.id === sourceId);
    const targetNode = nodes.find(node => node.id === targetId);
    
    if (!arrowNode || !sourceNode || !targetNode || !sourceNode.position || !targetNode.position) return;
    
    // Calculate midpoint between source and target
    const midX = (sourceNode.position[0] + targetNode.position[0]) / 2;
    const midY = (sourceNode.position[1] + targetNode.position[1]) / 2;
    
    // Update arrow node position
    arrowNode.position = [midX, midY];
    
    // Update arrow start and end points
    const arrowData = arrowNode.data?.find(data => data.type === '@ocif/node/arrow');
    if (arrowData) {
      arrowData.start = [sourceNode.position[0], sourceNode.position[1]];
      arrowData.end = [targetNode.position[0], targetNode.position[1]];
    }
  });

  // Normalize positions to ensure all nodes are visible
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  nodes.forEach(node => {
    if (node.position) {
      minX = Math.min(minX, node.position[0]);
      minY = Math.min(minY, node.position[1]);
      maxX = Math.max(maxX, node.position[0]);
      maxY = Math.max(maxY, node.position[1]);
    }
  });

  const scaleX = (width - 2 * padding) / (maxX - minX);
  const scaleY = (height - 2 * padding) / (maxY - minY);
  const scale = Math.min(scaleX, scaleY, 1);

  nodes.forEach(node => {
    if (node.position) {
      node.position[0] = padding + (node.position[0] - minX) * scale;
      node.position[1] = padding + (node.position[1] - minY) * scale;
    }
  });

  // Update arrow start and end points after normalization
  arrowRelations.forEach(relation => {
    const arrowNodeId = relation.data?.find(data => data.type === '@ocif/rel/edge')?.node;
    if (!arrowNodeId) return;
    
    const sourceId = relation.data?.find(data => data.type === '@ocif/rel/edge')?.start;
    const targetId = relation.data?.find(data => data.type === '@ocif/rel/edge')?.end;
    
    if (!sourceId || !targetId) return;
    
    const arrowNode = nodes.find(node => node.id === arrowNodeId);
    const sourceNode = nodes.find(node => node.id === sourceId);
    const targetNode = nodes.find(node => node.id === targetId);
    
    if (!arrowNode || !sourceNode || !targetNode || !sourceNode.position || !targetNode.position) return;
    
    // Update arrow start and end points
    const arrowData = arrowNode.data?.find(data => data.type === '@ocif/node/arrow');
    if (arrowData) {
      arrowData.start = [sourceNode.position[0], sourceNode.position[1]];
      arrowData.end = [targetNode.position[0], targetNode.position[1]];
    }
  });

  return ocifData;
} 