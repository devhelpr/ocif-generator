import React, { useMemo, useEffect, useRef } from "react";
import mermaid from "mermaid";
import { OCIFJson } from "../../services/svg-ocif-types/ocif";

interface OCIFMermaidViewProps {
  ocifData: OCIFJson | null;
}

const OCIFMermaidView: React.FC<OCIFMermaidViewProps> = ({ ocifData }) => {
  const mermaidRef = useRef<HTMLDivElement>(null);
  const idRef = useRef(`mermaid-${Math.random().toString(36).substr(2, 9)}`);

  useEffect(() => {
    // Initialize mermaid
    mermaid.initialize({
      startOnLoad: true,
      theme: "default",
      securityLevel: "loose",
      flowchart: {
        useMaxWidth: false,
        htmlLabels: true,
        curve: "basis",
      },
    });
  }, []);

  // Helper function to escape special characters for Mermaid
  const escapeMermaidText = (text: string): string => {
    return text
      .replace(/[()]/g, " ") // Replace parentheses with spaces
      .replace(/[<>]/g, " ") // Replace angle brackets with spaces
      .replace(/[{}]/g, " ") // Replace curly braces with spaces
      .replace(/[[\]]/g, " ") // Replace square brackets with spaces
      .replace(/[&]/g, "and") // Replace ampersand with 'and'
      .replace(/[|]/g, "or") // Replace pipe with 'or'
      .replace(/[\\]/g, " ") // Replace backslash with space
      .replace(/["]/g, "'") // Replace double quotes with single quotes
      .trim();
  };

  const mermaidDiagram = useMemo(() => {
    if (!ocifData?.nodes) return "";

    let diagram = "graph LR\n";
    const nodeStyles: { [key: string]: string } = {};
    const nodeIdMap: { [key: string]: string } = {};

    // Process nodes
    Object.entries(ocifData.nodes).forEach(([id, node]) => {
      if (node.data?.[0]?.type === "@ocif/node/arrow") return;

      const nodeData = node.data?.[0];
      let style = "";

      // Determine node style based on OCIF data
      if (nodeData?.type === "@ocif/node/oval") {
        style = "((";
      } else if (nodeData?.type === "@ocif/node/diamond") {
        style = "{";
      } else {
        style = "[";
      }

      // Get node text
      let nodeText = "Node";
      if (typeof node.text === "string") {
        nodeText = node.text;
      } else if (node.resource && ocifData.resources) {
        const resource = ocifData.resources.find((r) => r.id === node.resource);
        if (resource) {
          const textRep = resource.representations?.find(
            (rep) =>
              rep["mime-type"] === "text/plain" ||
              rep["mime-type"] === "text/markdown"
          );
          if (textRep?.content) {
            nodeText = textRep.content;
          }
        }
      }

      // Escape special characters in node text
      nodeText = escapeMermaidText(nodeText);

      // Create a safe node ID by prefixing with 'node_'
      const safeId = `node_${id}`;
      nodeIdMap[id] = safeId;

      // Add node to diagram with proper closing brackets
      if (nodeData?.type === "@ocif/node/oval") {
        diagram += `  ${safeId}${style}${nodeText}))\n`;
      } else if (nodeData?.type === "@ocif/node/diamond") {
        diagram += `  ${safeId}${style}${nodeText}}\n`;
      } else {
        diagram += `  ${safeId}${style}${nodeText}]\n`;
      }

      // Store node style for later use
      nodeStyles[id] = style;
    });

    // Process relations
    ocifData.relations?.forEach((relationGroup) => {
      relationGroup.data.forEach((relation) => {
        if (
          relation.type === "@ocif/rel/edge" &&
          relation.start &&
          relation.end
        ) {
          const startId = nodeIdMap[relation.start];
          const endId = nodeIdMap[relation.end];
          if (startId && endId) {
            diagram += `  ${startId} --> ${endId}\n`;
          }
        }
      });
    });

    return diagram;
  }, [ocifData]);

  useEffect(() => {
    async function renderMermaid() {
      if (mermaidRef.current) {
        try {
          console.log("mermaidDiagram", mermaidDiagram);
          const { svg, bindFunctions } = await mermaid.render(
            `mermaid-diagram-${idRef.current}`,
            mermaidDiagram,
            mermaidRef.current
          );
          mermaidRef.current.innerHTML = svg;
          bindFunctions?.(mermaidRef.current);
        } catch (e) {
          console.error("Error rendering Mermaid diagram:", e);
        }
      }
    }
    renderMermaid();
  }, [mermaidDiagram]);

  return (
    <div className="w-full h-[600px] overflow-auto bg-white p-4 rounded-lg border border-zinc-300">
      <div ref={mermaidRef} />
    </div>
  );
};

export default OCIFMermaidView;
