import { useEffect, useState } from "react";
import { Button } from "./ui/button";
import { useStores } from "@/store/StoreContext";
import { useToast } from "@/hooks/useToast";
import { observer } from "mobx-react-lite";
import {
  Popover,
  PopoverContent,
  PopoverTrigger
} from "@/components/ui/popover";
import { ChevronDownIcon } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";

/**
 * DashboardSidebar provides filtering options and actions for the dashboard.
 */
const DashboardSidebar = observer(() => {
  const dbStore = useStores().dbStore;
  const dashboardStore = useStores().dashboardStore;
  const indexingStore = useStores().indexingStore;

  const { showSuccess } = useToast();

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [openDateTo, setOpenDateTo] = useState(false);
  const [openDateFrom, setOpenDateFrom] = useState(false);

  const toggleSidebar = () => {
    setSidebarCollapsed(!sidebarCollapsed);
  };

  const currentProjectIdentifier = indexingStore.project?.repositoryIdentifier;

  // update available authors for filtering
  useEffect(() => {
    dbStore
      .runQuery("SELECT DISTINCT author_signature FROM commits;")
      .then((result) => {
        const authors = new Map<string, boolean>();
        (result as { author_signature: string }[]).forEach((row) => {
          authors.set(row.author_signature, true);
        });
        dashboardStore.setAvailableAuthors(authors);
      })
      .catch((error) => {
        console.error("Database connection error:", error);
      });
  }, [dbStore, dashboardStore, currentProjectIdentifier]);

  // handle export dashboard action to json and download it
  const handleExportDashboard = () => {
    dashboardStore.exportActiveDashboard();
    showSuccess("Dashboard exported successfully!");
  };

  const handleImportDashboard = () => {
    if (
      confirm(
        "Importing a dashboard will overwrite your current dashboard. Do you want to continue?"
      )
    ) {
      // open file picker to select json file
      const input = document.createElement("input");
      input.type = "file";
      input.accept = ".json,application/json";
      input.onchange = (e: Event) => {
        const target = e.target as HTMLInputElement;
        if (target.files && target.files.length > 0) {
          const file = target.files[0];
          const reader = new FileReader();
          reader.onload = (event: ProgressEvent<FileReader>) => {
            const jsonData = event.target?.result;
            if (typeof jsonData === "string") {
              dashboardStore.importDashboardFromJSON(jsonData);
              showSuccess("Dashboard imported successfully!");
            }
          };
          reader.readAsText(file);
        }
      };
      input.click();
    }
  };

  const handleAuthorSelectionChange = (author: string, selected: boolean) => {
    dashboardStore.setAuthorSelected(author, selected);
  };

  return (
    <div
      className={`bg-white shadow-md p-4 min-h-screen transition-all duration-300 ease-in-out ${
        sidebarCollapsed ? "w-16" : "w-64"
      }`}
    >
      <div className="flex justify-between items-center mb-4">
        {!sidebarCollapsed && (
          <h2 className="text-xl font-semibold text-gray-800">
            Dashboard Settings
          </h2>
        )}
        <button
          onClick={toggleSidebar}
          className="p-1 rounded-full hover:bg-gray-200"
        >
          {sidebarCollapsed ? (
            <img
              src="./icons/collapse.svg"
              alt="Expand Sidebar"
              className="h-5 w-5 rotate-180"
            />
          ) : (
            <img
              src="./icons/collapse.svg"
              alt="Collapse Sidebar"
              className="h-5 w-5"
            />
          )}
        </button>
      </div>

      {!sidebarCollapsed && (
        <div className="mt-4">
          <p className="text-gray-600">
            Apply global filters to apply to all dashboard widgets.
            <br />
            <small>Only applying to commit data at the moment.</small>
          </p>
          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Date Range:
            </label>
            {/* Date selection */}
            <Popover open={openDateFrom} onOpenChange={setOpenDateFrom}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  id="date"
                  className="w-48 justify-between font-normal"
                >
                  {dashboardStore.activeDateFilterFrom
                    ? dashboardStore.activeDateFilterFrom.toLocaleDateString()
                    : "Select FROM"}
                  <ChevronDownIcon />
                </Button>
              </PopoverTrigger>
              <PopoverContent
                className="w-auto overflow-hidden p-0"
                align="start"
              >
                <Calendar
                  mode="single"
                  selected={dashboardStore.activeDateFilterFrom}
                  captionLayout="dropdown"
                  onSelect={(date) => {
                    dashboardStore.activeDateFilterFrom = date ?? undefined;
                    setOpenDateFrom(false);
                  }}
                />
              </PopoverContent>
            </Popover>
            <div className="m-2"> </div>
            <Popover open={openDateTo} onOpenChange={setOpenDateTo}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  id="date"
                  className="w-48 justify-between font-normal"
                >
                  {dashboardStore.activeDateFilterTo
                    ? dashboardStore.activeDateFilterTo.toLocaleDateString()
                    : "Select TO"}
                  <ChevronDownIcon />
                </Button>
              </PopoverTrigger>
              <PopoverContent
                className="w-auto overflow-hidden p-0"
                align="start"
              >
                <Calendar
                  mode="single"
                  selected={dashboardStore.activeDateFilterTo}
                  captionLayout="dropdown"
                  onSelect={(date) => {
                    dashboardStore.activeDateFilterTo = date ?? undefined;
                    setOpenDateTo(false);
                  }}
                />
              </PopoverContent>
            </Popover>
            <br />
            {/* Author selection */}
            <label className="block text-sm font-medium text-gray-700 mb-1 mt-3">
              Authors:
            </label>
            <div className="max-h-40 overflow-y-auto border border-gray-200 rounded-md p-2">
              {Array.from(dashboardStore.availableAuthors.keys()).map(
                (author) => (
                  <div key={author} className="flex items-center mb-1">
                    <input
                      type="checkbox"
                      checked={dashboardStore.availableAuthors.get(author)}
                      onChange={(e) => {
                        handleAuthorSelectionChange(author, e.target.checked);
                      }}
                      className="mr-2"
                    />
                    <span className="text-sm text-gray-700">{author}</span>
                  </div>
                )
              )}
            </div>
          </div>
          {/* Export/Import actions */}
          <p className="mt-20">Dashboard Actions:</p>
          <div className="flex">
            <Button onClick={handleExportDashboard} className="" variant="link">
              Export
            </Button>
            <Button onClick={handleImportDashboard} className="" variant="link">
              Import
            </Button>
          </div>
        </div>
      )}
    </div>
  );
});

export default DashboardSidebar;
