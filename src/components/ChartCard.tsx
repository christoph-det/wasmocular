import React from "react";

interface ChartCardProps {
  chartId: string;
  title: string;
  description: string;
  chartWidth: "half" | "full";
  onToggleWidth: (chartId: string) => void;
  children?: React.ReactNode;
}

const ChartCard: React.FC<ChartCardProps> = ({
  chartId,
  title,
  description,
  chartWidth,
  onToggleWidth,
  children
}) => {
  return (
    <div
      className={`bg-white rounded-xl shadow-lg border border-gray-200 p-4 transition-shadow duration-300 ${chartWidth === "full" ? "col-span-1 lg:col-span-2" : "col-span-1"}`}
    >
      <div className="flex justify-between items-start">
        <div>
          <h3 className="text-xl font-semibold mb-1">{title}</h3>
          <p className="text-sm text-gray-500 mb-5">{description}</p>
        </div>
        <button
          onClick={() => onToggleWidth(chartId)}
          className="px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded-sm"
        >
          Width: {chartWidth}
        </button>
      </div>

      <div className="flex justify-center">{children}</div>
    </div>
  );
};

export default ChartCard;
