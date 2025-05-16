import { FC } from "react";

export type LayoutType = "grid" | "dagre" | "force" | "circular";

interface LayoutOptionsProps {
  layout: LayoutType;
  onLayoutChange: (layout: LayoutType) => void;
}

export const LayoutOptions: FC<LayoutOptionsProps> = ({
  layout,
  onLayoutChange,
}) => {
  return (
    <div className="flex items-center gap-2 p-2 bg-white rounded-lg shadow-sm">
      <label className="text-sm font-medium text-gray-700">Layout:</label>
      <select
        value={layout}
        onChange={(e) => onLayoutChange(e.target.value as LayoutType)}
        className="px-2 py-1 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <option value="grid">Grid</option>
        <option value="dagre">Dagre</option>
        <option value="force">Force</option>
        <option value="circular">Circular</option>
      </select>
    </div>
  );
};
