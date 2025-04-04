interface Node {
  id: string;
  position: number[];
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

/**
 * Applies force-directed layout to OCIF nodes
 * @param ocifData The OCIF data to layout
 * @returns The OCIF data with updated node positions
 */
export function applyAutoLayout(ocifData: OCIFData): OCIFData {
  const nodes = ocifData.nodes;
  const relations = ocifData.relations;

  // Default canvas size
  const canvasWidth = 1000;
  const canvasHeight = 800;
  const padding = 50;

  // Layout parameters
  const iterations = 100;
  const k = Math.sqrt((canvasWidth * canvasHeight) / nodes.length); // Optimal distance between nodes
  const gravity = 0.1;
  const defaultNodeSize = [100, 100];

  // Initialize random positions if not set
  nodes.forEach(node => {
    if (!node.position || node.position.length < 2) {
      node.position = [
        padding + Math.random() * (canvasWidth - 2 * padding),
        padding + Math.random() * (canvasHeight - 2 * padding)
      ];
    }
    if (!node.size || node.size.length < 2) {
      node.size = [...defaultNodeSize];
    }
  });

  // Create adjacency map from relations
  const adjacencyMap = new Map<string, Set<string>>();
  relations.forEach(relation => {
    if (relation.source && relation.target) {
      if (!adjacencyMap.has(relation.source)) {
        adjacencyMap.set(relation.source, new Set());
      }
      if (!adjacencyMap.has(relation.target)) {
        adjacencyMap.set(relation.target, new Set());
      }
      adjacencyMap.get(relation.source)?.add(relation.target);
      adjacencyMap.get(relation.target)?.add(relation.source);
    }
  });

  // Run force-directed layout
  for (let i = 0; i < iterations; i++) {
    // Calculate repulsive forces between all nodes
    const forces = new Map<string, [number, number]>();
    nodes.forEach(node => forces.set(node.id, [0, 0]));

    // Repulsive forces between nodes
    for (let v1 = 0; v1 < nodes.length; v1++) {
      for (let v2 = v1 + 1; v2 < nodes.length; v2++) {
        const node1 = nodes[v1];
        const node2 = nodes[v2];
        const dx = node2.position[0] - node1.position[0];
        const dy = node2.position[1] - node1.position[1];
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist === 0) continue;

        // Repulsive force
        const force = k * k / dist;
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;

        const f1 = forces.get(node1.id) || [0, 0];
        const f2 = forces.get(node2.id) || [0, 0];
        forces.set(node1.id, [f1[0] - fx, f1[1] - fy]);
        forces.set(node2.id, [f2[0] + fx, f2[1] + fy]);
      }
    }

    // Attractive forces between connected nodes
    nodes.forEach(node1 => {
      const connected = adjacencyMap.get(node1.id);
      if (connected) {
        connected.forEach(targetId => {
          const node2 = nodes.find(n => n.id === targetId);
          if (node2) {
            const dx = node2.position[0] - node1.position[0];
            const dy = node2.position[1] - node1.position[1];
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist === 0) return;

            // Attractive force
            const force = dist * dist / k;
            const fx = (dx / dist) * force;
            const fy = (dy / dist) * force;

            const f1 = forces.get(node1.id) || [0, 0];
            const f2 = forces.get(node2.id) || [0, 0];
            forces.set(node1.id, [f1[0] + fx * 0.5, f1[1] + fy * 0.5]);
            forces.set(node2.id, [f2[0] - fx * 0.5, f2[1] - fy * 0.5]);
          }
        });
      }
    });

    // Apply forces and gravity
    nodes.forEach(node => {
      const force = forces.get(node.id) || [0, 0];
      
      // Add gravity towards center
      const dx = canvasWidth / 2 - node.position[0];
      const dy = canvasHeight / 2 - node.position[1];
      force[0] += dx * gravity;
      force[1] += dy * gravity;

      // Update position
      node.position[0] += Math.min(Math.max(force[0], -50), 50);
      node.position[1] += Math.min(Math.max(force[1], -50), 50);

      // Keep within bounds
      node.position[0] = Math.min(Math.max(node.position[0], padding), canvasWidth - padding);
      node.position[1] = Math.min(Math.max(node.position[1], padding), canvasHeight - padding);
    });
  }

  // Normalize positions to ensure all nodes are visible
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  nodes.forEach(node => {
    minX = Math.min(minX, node.position[0]);
    minY = Math.min(minY, node.position[1]);
    maxX = Math.max(maxX, node.position[0]);
    maxY = Math.max(maxY, node.position[1]);
  });

  const scaleX = (canvasWidth - 2 * padding) / (maxX - minX);
  const scaleY = (canvasHeight - 2 * padding) / (maxY - minY);
  const scale = Math.min(scaleX, scaleY, 1);

  nodes.forEach(node => {
    node.position[0] = padding + (node.position[0] - minX) * scale;
    node.position[1] = padding + (node.position[1] - minY) * scale;
  });

  return ocifData;
} 