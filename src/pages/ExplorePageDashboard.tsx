import ExploreNavigationBar from "@/components/ExploreNavigationBar";
import DashboardSidebar from "@/components/DashboardSidebar";
import ChartCard from "@/components/ChartCard";

import { useStores } from "@/store/StoreContext";
import { observer } from "mobx-react-lite";
import { Link } from "react-router-dom";

/**
 * ExplorePageDashboard component renders the dashboard page (with widgets) and navigation bar,
 */
const ExplorePageDashboard = observer(() => {
  const dashboardStore = useStores().dashboardStore;
  const widgets = dashboardStore.activeDashboard?.widgets ?? [];

  return (
    <div className="mx-0 bg-gradient-to-br from-gray-50 to-gray-200 min-h-screen">
      <ExploreNavigationBar />
      <div className="flex">
        <DashboardSidebar />

        <div className="flex-1 p-5">
          <div className="mx-auto">
            {widgets.length === 0 ? (
              <div>
                Need some inspiration? Copy an example query from{" "}
                <Link to="/sql-examples" className="text-blue-600 hover:underline">
                  here
                </Link>{" "}
                and create your first chart.
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {widgets.map((widget) => (
                  <ChartCard key={widget.id} dashboardElement={widget} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});

export default ExplorePageDashboard;
