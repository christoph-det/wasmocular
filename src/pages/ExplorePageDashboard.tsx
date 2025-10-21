import ExploreNavigationBar from "@/components/ExploreNavigationBar";
import DashboardSidebar from "@/components/DashboardSidebar";
import ChartCard from "@/components/ChartCard";
import { useEffect, useState } from "react";

import { LineChart, Line } from "recharts";
import { useStores } from "@/store/StoreContext";
const sampleData = [
  { additions: 0, deletions: 0 }
];

const ExplorePageDashboard = () => {
  const dbStore = useStores().dbStore;
  const indexingStore = useStores().indexingStore;

  const [actualData, setActualData] = useState(sampleData);

  useEffect(() => {
    const repositoryIdentifier = indexingStore.project?.repositoryIdentifier;
    if (!repositoryIdentifier) return;

    const query = `SELECT additions, -CAST(deletions AS INTEGER) AS deletions FROM indexer_commits_${repositoryIdentifier} LIMIT 100`;

    dbStore
      .runQuery(query, true)
      .then((result) => {
        console.log("Query result for chart data:", result);
        if (Array.isArray(result)) {
          const normalized = result.map((row) => {
            const additions = Number(
              (row as Record<string, unknown>).additions ?? 0
            );
            const deletions = Number(
              (row as Record<string, unknown>).deletions ?? 0
            );
            return { additions, deletions };
          });
          setActualData(normalized);
        } else {
          console.warn("Unexpected query result format:", result);
        }
      })
      .catch((error) => {
        console.error("Failed to fetch chart data:", error);
      });
  }, [dbStore, indexingStore.project?.repositoryIdentifier]);

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
                  stackOffset="sign"
                  width={chartWidths.chart1 === "full" ? 1000 : 600}
                  height={300}
                  data={actualData}
                >
                  <Line dataKey="additions" stroke="#3B82F6" strokeWidth={2} />
                  <Line dataKey="deletions" stroke="#EF4444" strokeWidth={2} />
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
