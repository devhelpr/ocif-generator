import * as d3 from 'd3-force';

interface Node {
  id: string;
  position?: number[];
  size?: number[];
  [key: string]: any;
}

interface Relation {
  id: string;
  source?: string;
  target?: string;
  [key: string]: any;
}

interface OCIFData {
  ocif: string;
  nodes: Node[];
  relations: Relation[];
  resources: any[];
  schemas: any[];
}

interface D3Node extends d3.SimulationNodeDatum {
  id: string;
  x: number;
  y: number;
  size?: number[];
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

  // Create d3 nodes and links
  const d3Nodes: D3Node[] = nodes.map(node => {
    // Initialize position if not set
    const position = node.position || [
      padding + Math.random() * (width - 2 * padding),
      padding + Math.random() * (height - 2 * padding)
    ];
    
    return {
      id: node.id,
      x: position[0],
      y: position[1],
      size: node.size || [100, 100],
      originalData: node
    };
  });

  const d3Links: D3Link[] = relations
    .filter(relation => relation.source && relation.target)
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
    .force('link', d3.forceLink<D3Node, D3Link>(d3Links)
      .id(d => d.id)
      .distance(150) // Distance between connected nodes
    )
    .force('charge', d3.forceManyBody()
      .strength(-300) // Repulsion strength
    )
    .force('center', d3.forceCenter(width / 2, height / 2))
    .force('collision', d3.forceCollide()
      .radius(d => Math.max(d.size?.[0] || 50, d.size?.[1] || 50) / 2 + 10)
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

  return ocifData;
} 