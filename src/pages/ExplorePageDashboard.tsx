import ExploreNavigationBar from "@/components/ExploreNavigationBar";
import DashboardSidebar from "@/components/DashboardSidebar";
import ChartCard from "@/components/ChartCard";

import { useStores } from "@/store/StoreContext";

const ExplorePageDashboard = () => {
  const dashboardStore = useStores().dashboardStore;

  return (
    <div className="mx-0 bg-gradient-to-br from-gray-50 to-gray-200 min-h-screen">
      <ExploreNavigationBar />
      <div className="flex">
        <DashboardSidebar />

        <div className="flex-1 p-5">
          <div className="mx-auto">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

              {dashboardStore.activeDashboard?.widgets.map((widget) => (
                <ChartCard
                  dashboardElement={widget}
                />
              ))}

            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExplorePageDashboard;
