import { ReactElement, useEffect, useState } from "react";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ChartType, DashboardElement } from "@/store/DashboardElement";
import {
  TimeResolution,
  TIME_RESOLUTIONS
} from "@/lib/chartConverters/BaseChartConverter";
import { useStores } from "@/store/StoreContext";
import { useToast } from "@/hooks/useToast";

interface CreateDashboardWidgetDialogProps {
  sqlQuery: string;
  trigger: ReactElement;
  editMode?: boolean;
  dashboardElement?: DashboardElement;
}

const CHART_TYPE_OPTIONS = Object.values(ChartType) as ChartType[];

interface FormState {
  title: string;
  description: string;
  width: "half" | "full";
  sql: string;
  chartType: ChartType;
  timeResolution: TimeResolution;
}

const formatChartTypeLabel = (type: ChartType) =>
  type
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

const CreateDashboardWidgetDialog = ({
  sqlQuery,
  trigger,
  editMode = false,
  dashboardElement
}: CreateDashboardWidgetDialogProps) => {
  const { dashboardStore } = useStores();
  const { showError, showSuccess } = useToast();
  const [open, setOpen] = useState(false);
  const [formState, setFormState] = useState<FormState>({
    title: dashboardElement?.title ?? "",
    description: dashboardElement?.description ?? "",
    width: dashboardElement?.chartWidth ?? "half",
    sql: dashboardElement?.sqlQuery ?? sqlQuery,
    chartType: dashboardElement?.type ?? ChartType.TEXT,
    timeResolution: dashboardElement?.timeResolution ?? "months"
  });

  useEffect(() => {
    if (open) {
      setFormState((state) => ({
        ...state,
        sql: dashboardElement?.sqlQuery ?? sqlQuery
      }));
    }
  }, [sqlQuery, open, dashboardElement?.sqlQuery]);

  const handleSubmit = () => {
    if (!dashboardStore.activeDashboard) {
      showError("No active dashboard is available.");
      return;
    }

    if (!formState.sql.trim() || !formState.title.trim()) {
      showError("SQL query and title are required.");
      return;
    }

    if (editMode && dashboardElement) {
      dashboardElement.title = formState.title;
      dashboardElement.description = formState.description;
      dashboardElement.chartWidth = formState.width;
      dashboardElement.sqlQuery = formState.sql;
      dashboardElement.type = formState.chartType;
      dashboardElement.timeResolution = formState.timeResolution;

      showSuccess("Widget updated successfully.");
    } else {
      const widget = new DashboardElement(
        crypto.randomUUID(),
        formState.title.trim(),
        formState.description.trim(),
        formState.width,
        formState.chartType,
        formState.sql,
        formState.timeResolution
      );

      dashboardStore.activeDashboard.widgets.push(widget);
      showSuccess("Widget added to dashboard.");
    }
    setOpen(false);
  };

  const handleDelete = () => {
    if (!confirm("Are you sure you want to delete this widget?")) {
      return;
    }
    console.log("Deleting widget:", dashboardElement);
    if (dashboardElement && dashboardStore.activeDashboard) {
      dashboardStore.activeDashboard.widgets =
        dashboardStore.activeDashboard.widgets.filter(
          (w) => w.id !== dashboardElement.id
        );
      showSuccess("Widget deleted from dashboard.");
      setOpen(false);
    } else {
      showError("Failed to delete widget due to inconsistent state.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Add Widget to Dashboard</DialogTitle>
        </DialogHeader>
        <Label>Chart Title</Label>
        <Input
          value={formState.title}
          onChange={(event) =>
            setFormState((state) => ({ ...state, title: event.target.value }))
          }
          type="text"
        />
        <Label>Description</Label>
        <textarea
          className="border-input w-full rounded-md border px-3 py-2 text-sm"
          value={formState.description}
          onChange={(event) =>
            setFormState((state) => ({
              ...state,
              description: event.target.value
            }))
          }
        />
        <Label>Chart Type</Label>
        <select
          className="border-input w-full rounded-md border px-3 py-2 text-sm"
          value={formState.chartType}
          onChange={(event) =>
            setFormState((state) => ({
              ...state,
              chartType: event.target.value as ChartType
            }))
          }
        >
          {CHART_TYPE_OPTIONS.map((type) => (
            <option key={type} value={type}>
              {formatChartTypeLabel(type)}
            </option>
          ))}
        </select>
        {formState.chartType === ChartType.STACKED_AREA_CHART && (
          <>
            <Label>Time Resolution</Label>
            <select
              className="border-input w-full rounded-md border px-3 py-2 text-sm"
              value={formState.timeResolution}
              onChange={(event) =>
                setFormState((state) => ({
                  ...state,
                  timeResolution: event.target.value as TimeResolution
                }))
              }
            >
              {TIME_RESOLUTIONS.map((resolution) => (
                <option key={resolution} value={resolution}>
                  {resolution}
                </option>
              ))}
            </select>
          </>
        )}
        <Label>Width</Label>
        <select
          className="border-input w-full rounded-md border px-3 py-2 text-sm"
          value={formState.width}
          onChange={(event) =>
            setFormState((state) => ({
              ...state,
              width: event.target.value as "half" | "full"
            }))
          }
        >
          <option value="half">Half</option>
          <option value="full">Full</option>
        </select>
        <Label>SQL Query</Label>
        <textarea
          className="border-input min-h-[8rem] w-full rounded-md border px-3 py-2 text-sm font-mono"
          value={formState.sql}
          onChange={(event) =>
            setFormState((state) => ({ ...state, sql: event.target.value }))
          }
        />
        <DialogFooter>
          {editMode && (
            <Button
              type="button"
              variant="destructive"
              className="mr-auto"
              onClick={handleDelete}
            >
              Delete Widget
            </Button>
          )}
          <DialogClose asChild>
            <Button type="button" variant="outline">
              Cancel
            </Button>
          </DialogClose>
          <Button type="button" onClick={handleSubmit}>
            {editMode ? "Update Widget" : "Add Widget"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CreateDashboardWidgetDialog;
