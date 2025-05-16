import { memo } from "react";
import { Handle, Position, NodeProps } from "reactflow";

const CustomNode = ({ data, type }: NodeProps) => {
  const { label, style } = data;
  const { width, height, backgroundColor, borderColor, borderWidth } = style;

  const renderNode = () => {
    switch (type) {
      case "diamond":
        return (
          <div
            style={{
              width,
              height,
              backgroundColor,
              border: `${borderWidth}px solid ${borderColor}`,
              clipPath: "polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "10px",
              textAlign: "center",
              outline: "none",
            }}
          >
            {label}
          </div>
        );
      case "ellipse":
        return (
          <div
            style={{
              width,
              height,
              backgroundColor,
              border: `${borderWidth}px solid ${borderColor}`,
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "10px",
              textAlign: "center",
              outline: "none",
            }}
          >
            {label}
          </div>
        );
      default:
        return (
          <div
            style={{
              width,
              height,
              backgroundColor,
              border: `${borderWidth}px solid ${borderColor}`,
              borderRadius: "8px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "10px",
              textAlign: "center",
              outline: "none",
            }}
          >
            {label}
          </div>
        );
    }
  };

  return (
    <>
      <Handle
        type="target"
        position={Position.Left}
        style={{ opacity: 0, width: 0, height: 0 }}
      />
      {renderNode()}
      <Handle
        type="source"
        position={Position.Right}
        style={{ opacity: 0, width: 0, height: 0 }}
      />
    </>
  );
};

export default memo(CustomNode);
