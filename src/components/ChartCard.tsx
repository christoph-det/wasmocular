import { ChartType, DashboardElement } from "@/store/DashboardElement";
import React, { useEffect } from "react";
import { observer } from "mobx-react-lite";
import { Spinner } from "./ui/spinner";
import TextDisplay from "./vizualisation/TextDisplay";
import * as d3 from "d3";
import StackedAreaChart from "./vizualisation/binocular/StackedAreaChartBinocular";
import CreateDashboardWidgetDialog from "./CreateDashboardWidgetDialog";
import { Button } from "./ui/button";
import { StackedAreaChartConverter } from "@/lib/chartConverters/converters/StackedAreaChartConverter";
import { GenericDataRow } from "@/lib/chartConverters/BaseChartConverter";
import generateColorPalette from "@/lib/colorPaletteGenerator";
import ReactECharts from "echarts-for-react";

interface ChartCardProps {
  dashboardElement: DashboardElement;
}

const ChartCard: React.FC<ChartCardProps> = observer(({ dashboardElement }) => {
  const query = dashboardElement.sqlQuery;
  const fromTimestamp =
    dashboardElement.dashboardStore.activeDateFilterFrom?.getTime();
  const toTimestamp =
    dashboardElement.dashboardStore.activeDateFilterTo?.getTime();
  const unselectedAuthors = dashboardElement.dashboardStore.unselectedAuthors;

  useEffect(() => {
    dashboardElement.loadData().catch((error) => {
      console.error("Error loading dashboard element data:", error);
    });
  }, [dashboardElement, query, fromTimestamp, toTimestamp, unselectedAuthors]);

  return (
    <div
      className={`bg-white h-full min-h-[25rem] flex flex-col rounded-xl shadow-lg border border-gray-200 p-4 transition-shadow duration-300 ${dashboardElement.chartWidth === "full" ? "col-span-1 lg:col-span-2" : "col-span-1"}`}
    >
      <div className="flex justify-between items-start">
        <div>
          <h3 className="text-xl font-semibold mb-1">
            {dashboardElement.title}
          </h3>
          <p className="text-sm text-gray-500 mb-2">
            {dashboardElement.description}
          </p>
        </div>
        <CreateDashboardWidgetDialog
          editMode={true}
          dashboardElement={dashboardElement}
          sqlQuery={""}
          trigger={
            <Button
              size="sm"
              type="button"
              className=" bg-gray-100 hover:bg-gray-200 rounded-sm text-black"
            >
              Edit
            </Button>
          }
        />
      </div>

      <div className="flex justify-center items-stretch m-0 p-0 flex-1 w-full">
        {dashboardElement.dataLoading ? (
          <div className="w-full h-full flex items-center justify-center">
            <Spinner className="mr-2" />
            Loading
          </div>
        ) : (
          <div className="w-full h-full overflow-auto">
            {resolveChartByType(dashboardElement)}
          </div>
        )}
      </div>
    </div>
  );
});

function resolveChartByType(
  dashboardElement: DashboardElement
): React.ReactNode {
  switch (dashboardElement.type) {
    case ChartType.TEXT:
      return (
        <TextDisplay
          data={dashboardElement.data}
          error={dashboardElement.error}
        />
      );
    case ChartType.STACKED_AREA_CHART: {
      const resolution = dashboardElement.timeResolution;
      const stackedDatasetConverter = new StackedAreaChartConverter(resolution);
      const stackedDataset = stackedDatasetConverter.convert(
        dashboardElement.data as GenericDataRow[]
      );

      if (stackedDataset.error) {
        return (
          <div className="text-gray-700 p-4">
            <p className="font-semibold text-red-600">Error</p>
            <p className="text-sm">{dashboardElement.error}</p>
            <p className="text-sm">{stackedDataset.error}</p>
          </div>
        );
      } else {
        return (
          <StackedAreaChart
            content={stackedDataset.content}
            palette={generateColorPalette(stackedDataset.keys)}
            paddings={{ top: 10, right: 0, bottom: 10, left: 50 }}
            xAxisCenter={true}
            yDims={stackedDataset.yDims}
            d3offset={d3.stackOffsetDiverging}
            resolution={resolution}
            displayNegative={true}
          />
        );
      }
    }
    case ChartType.HEATMAP: {
      const sqlData = dashboardElement.data as {
        x: string;
        y: string;
        v: number;
      }[];

      // Extract unique categories for axes
      const xCategories = [...new Set(sqlData.map((row) => row.x))];
      const yCategories = [...new Set(sqlData.map((row) => row.y))];

      // Map data to category indices for proper positioning
      const formattedData = sqlData.map((row) => [
        xCategories.indexOf(row.x),
        yCategories.indexOf(row.y),
        row.v
      ]);

      const maxValue = Math.max(...sqlData.map((d) => d.v));

      const option = {
        tooltip: {
          confine: false,
          appendToBody: true,
          formatter: (params: { data: [number, number, number] }) => {
            const [xIdx, yIdx, value] = params.data;
            return `${xCategories[xIdx]}, ${yCategories[yIdx]}: <strong>${value}</strong>`;
          }
        },
        grid: {
          top: 0,
          right: 0,
          bottom: 60,
          left: 0,
          containLabel: true
        },
        xAxis: {
          type: "category",
          data: xCategories,
          splitArea: { show: true },
          axisLabel: { interval: 0 }
        },
        yAxis: {
          type: "category",
          data: yCategories,
          splitArea: { show: true }
        },
        visualMap: {
          min: 0,
          max: maxValue,
          calculable: true,
          orient: "horizontal",
          left: "center",
          bottom: 0,
          inRange: { color: ["#e0f7fa", "#006edd"] }
        },
        series: [
          {
            type: "heatmap",
            data: formattedData,
            label: { show: false },
            emphasis: {
              itemStyle: { shadowBlur: 10, shadowColor: "rgba(0, 0, 0, 0.5)" }
            }
          }
        ]
      };

      return (
        <ReactECharts
          option={option}
          style={{ height: "100%", width: "100%" }}
        />
      );
    }
    default:
      return "Unknown Chart Type";
  }
}

export default ChartCard;
