import { ChartType, DashboardElement } from "@/store/DashboardElement";
import React, { useEffect } from "react";
import { observer } from "mobx-react-lite";
import { Spinner } from "./ui/spinner";
import TextDisplay from "./vizualisation/TextDisplay";
import * as d3 from "d3";
import StackedAreaChart from "./vizualisation/StackedAreaChartBinocular";

interface ChartCardProps {
  dashboardElement: DashboardElement;
  children?: React.ReactNode;
}

const ChartCard: React.FC<ChartCardProps> = observer(({
  dashboardElement,
  children
}) => {
  const keyedChildren = React.Children.map(children, (child) => {
    if (React.isValidElement(child)) {
      return React.cloneElement(child, { key: `${dashboardElement.id}-${dashboardElement.chartWidth}` });
    }
    return child;
  });

  useEffect(() => {
    dashboardElement.loadData();
  }, [dashboardElement]);


  return (
    <div
      className={`bg-white h-full min-h-[25rem] flex flex-col rounded-xl shadow-lg border border-gray-200 p-4 transition-shadow duration-300 ${dashboardElement.chartWidth === "full" ? "col-span-1 lg:col-span-2" : "col-span-1"}`}
    >
      <div className="flex justify-between items-start">
        <div>
          <h3 className="text-xl font-semibold mb-1">{dashboardElement.title}</h3>
          <p className="text-sm text-gray-500 mb-2">{dashboardElement.description}</p>
        </div>
        <button
          onClick={() => dashboardElement.toggleWidth()}
          className="px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded-sm"
        >
          Width: {dashboardElement.chartWidth}
        </button>
      </div>

      <div className="flex justify-center items-stretch m-0 p-0 flex-1 w-full">
        {dashboardElement.dataLoading ? (
          <div className="w-full h-full flex items-center justify-center"><Spinner className="mr-2"/>Loading</div>
        ) : (
          <div className="w-full h-full">{resolveChartByType(dashboardElement)}</div>
        )}
      </div>
    </div>
  );
});

function resolveChartByType(dashboardElement: DashboardElement): React.ReactNode {
  switch (dashboardElement.type) {
    case ChartType.TEXT:
      return <TextDisplay data={dashboardElement.data} error={dashboardElement.error} />;
    case ChartType.STACKED_AREA_CHART: 
     let stackedDataset;
      if (Array.isArray(dashboardElement.data)) {
            const normalized = dashboardElement.data.map((row, index) => {
              const record = row as QueryRow;
              const additions = Number(record.additions ?? 0);
              const deletions = Number(record.deletions ?? 0);
              const rawDate =
                record.author_date ?? record.committer_date ?? record.date ?? null;
              const date = parseRowTimestamp(rawDate, index);

              return { additions, deletions, date };
            });

            stackedDataset = convertToStackedAreaDataset(normalized);
          }
      return <StackedAreaChart
                        content={stackedDataset!.content}
                        palette={stackedChartDefaults.palette}
                        paddings={stackedChartDefaults.paddings}
                        xAxisCenter={stackedChartDefaults.xAxisCenter}
                        yDims={stackedDataset!.yDims}
                        d3offset={stackedChartDefaults.d3offset}
                        keys={stackedChartDefaults.keys}
                        resolution={stackedChartDefaults.resolution}
                        displayNegative={stackedChartDefaults.displayNegative}
                        order={stackedChartDefaults.order}
                      />;
    default:
      return "Unknown Chart Type";
  }
}

type LineSeriesPoint = { additions: number; deletions: number; date: number };
type QueryRow = Record<string, unknown>;

const STACKED_SERIES = {
  additions: "(Additions) Total",
  deletions: "(Deletions) Total"
} as const;

const FALLBACK_DATE_START = new Date("2024-01-01").getTime();
const DAY_IN_MS = 24 * 60 * 60 * 1000;

const parseRowTimestamp = (value: unknown, index: number) => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    if (!Number.isNaN(parsed)) {
      return parsed;
    }
  }
  return FALLBACK_DATE_START + index * DAY_IN_MS;
};



const stackedChartDefaults = {
  content: [{}],
  palette: {
    [STACKED_SERIES.additions]: "#3B82F6",
    [STACKED_SERIES.deletions]: "#EF4444"
  },
  paddings: { top: 20, right: 30, bottom: 30, left: 60 },
  xAxisCenter: true,
  yDims: [-200, 200],
  d3offset: d3.stackOffsetDiverging,
  keys: [STACKED_SERIES.additions, STACKED_SERIES.deletions],
  resolution: "days",
  displayNegative: true,
  order: ["Total"]
};

const convertToStackedAreaDataset = (rows: LineSeriesPoint[]) => {
  if (!rows.length) {
    return {
      content: [
        {
          date: FALLBACK_DATE_START,
          [STACKED_SERIES.additions]: 0,
          [STACKED_SERIES.deletions]: 0
        }
      ],
      yDims: [-1, 1]
    };
  }

  const content = rows.map((row) => ({
    date: row.date,
    [STACKED_SERIES.additions]: row.additions,
    [STACKED_SERIES.deletions]: row.deletions
  }));

  const maxAbs = content.reduce((max, entry) => {
    const entryMax = Math.max(
      Math.abs(entry[STACKED_SERIES.additions]),
      Math.abs(entry[STACKED_SERIES.deletions])
    );
    return Math.max(max, entryMax);
  }, 0);

  const safeExtent = maxAbs || 1;

  return {
    content,
    yDims: [-safeExtent, safeExtent]
  };
};


export default ChartCard;
