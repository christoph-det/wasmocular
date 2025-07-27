import ExploreNavigationBar from "@/components/ExploreNavigationBar";
import DashboardSidebar from "@/components/DashboardSidebar";
import ChartCard from "@/components/ChartCard";
import { useState } from "react";

import { LineChart, Line } from "recharts";
const sampleData = [
  { uv: 400 },
  { uv: 300 },
  { uv: 200 },
  { uv: 278 },
  { uv: 189 }
];

const ExplorePageDashboard = () => {
  const [chartWidths, setChartWidths] = useState<
    Record<string, "half" | "full">
  >({
    chart1: "half",
    chart2: "half"
  });

  const toggleChartWidth = (chartId: string) => {
    setChartWidths({
      ...chartWidths,
      [chartId]: chartWidths[chartId] === "half" ? "full" : "half"
    });
  };

  return (
    <div className="mx-0 bg-gradient-to-br from-gray-50 to-gray-200 min-h-screen">
      <ExploreNavigationBar />
      <div className="flex">
        <DashboardSidebar />

        <div className="flex-1 p-5">
          <div className="mx-auto">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <ChartCard
                chartId="chart1"
                title="Example Data Trends"
                description="Commit activity over time"
                chartWidth={chartWidths.chart1}
                onToggleWidth={toggleChartWidth}
              >
                <LineChart
                  width={chartWidths.chart1 === "full" ? 1000 : 600}
                  height={300}
                  data={sampleData}
                >
                  <Line dataKey="uv" stroke="#3B82F6" strokeWidth={2} />
                </LineChart>
              </ChartCard>

              <ChartCard
                chartId="chart2"
                title="Other Chart"
                description="Coming soon"
                chartWidth={chartWidths.chart2}
                onToggleWidth={toggleChartWidth}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExplorePageDashboard;
