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
import { useStores } from "@/store/StoreContext";
import { useToast } from "@/hooks/useToast";

interface CreateDashboardWidgetDialogProps {
  sqlQuery: string;
  trigger?: ReactElement;
}

const CHART_TYPE_OPTIONS = Object.values(ChartType) as ChartType[];

interface FormState {
  title: string;
  description: string;
  sql: string;
  chartType: ChartType;
}

const formatChartTypeLabel = (type: ChartType) =>
  type
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

const CreateDashboardWidgetDialog = ({
  sqlQuery,
  trigger
}: CreateDashboardWidgetDialogProps) => {
  const { dashboardStore } = useStores();
  const { showError, showSuccess } = useToast();
  const [open, setOpen] = useState(false);
  const [formState, setFormState] = useState<FormState>({
    title: "",
    description: "",
    sql: sqlQuery,
    chartType: ChartType.TEXT
  });

  useEffect(() => {
    if (open) {
      setFormState((state) => ({
        ...state,
        sql: sqlQuery,
        chartType: state.chartType
      }));
    }
  }, [sqlQuery, open]);

  const handleSubmit = () => {
    if (!dashboardStore.activeDashboard) {
      showError("No active dashboard is available.");
      return;
    }

    if (!formState.sql.trim() || !formState.title.trim()) {
      showError("SQL query and title are required.");
      return;
    }

    const widget = new DashboardElement(
      crypto.randomUUID(),
      formState.title.trim(),
      formState.description.trim(),
      "half",
      formState.chartType,
      formState.sql
    );

    dashboardStore.activeDashboard.widgets.push(widget);
    showSuccess("Widget added to dashboard.");
    setOpen(false);
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
        <Label htmlFor="widget-sql">SQL Query</Label>
        <textarea
          id="widget-sql"
          className="border-input min-h-[8rem] w-full rounded-md border px-3 py-2 text-sm font-mono"
          value={formState.sql}
          onChange={(event) =>
            setFormState((state) => ({ ...state, sql: event.target.value }))
          }
        />
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">
              Cancel
            </Button>
          </DialogClose>
          <Button type="button" onClick={handleSubmit}>
            Add Widget
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CreateDashboardWidgetDialog;
