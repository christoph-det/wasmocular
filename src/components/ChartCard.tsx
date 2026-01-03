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
      // TODO: make resolution configurable
      const resolution = "months";
      const stackedDatasetConverter = new StackedAreaChartConverter(resolution);
      const stackedDataset = stackedDatasetConverter.convert(
            dashboardElement.data as GenericDataRow[]
      );

      if (stackedDataset.error) {
        return (
          <div className="text-gray-700 p-4">
            <p className="font-semibold text-red-600">Error</p>
            <p className="text-sm">{dashboardElement.error}</p>
            <p className="text-sm">{stackedDataset.error} - Expected columns: date (timestamp), series (string), value
              (number)</p>
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
    default:
      return "Unknown Chart Type";
  }
}

export default ChartCard;
