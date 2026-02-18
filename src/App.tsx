import { HashRouter as Router, Route, Routes } from "react-router-dom";
import { useEffect } from "react";
import "./App.css";
import NavigationBar from "./components/NavigationBar";
import IndexPage from "./pages/IndexPage";
import LoadPage from "./pages/LoadPage";
import Footer from "./components/Footer";
import { StoreContext, rootStore } from "./store/StoreContext";
import ExplorePageDashboard from "./pages/ExplorePageDashboard";
import ExplorePageCustomQuery from "./pages/ExplorePageCustomQuery";
import SettingsPage from "./pages/SettingsPage";
import SQLExamplesPage from "./pages/SQLExamplesPage";
import { createExampleProjectOnFirstVisit } from "./lib/bootstrapExampleProject";

const App: React.FC = () => {
  const hasNoStoredProjects =
    rootStore.indexingStore.listAllStoredProjects().length === 0;

  useEffect(() => {
    if (hasNoStoredProjects) {
      createExampleProjectOnFirstVisit();
    }
  }, [hasNoStoredProjects]);

  return (
    <StoreContext.Provider value={rootStore}>
      <Router>
        <NavigationBar />
        <Routes>
          <Route path="/" element={<LoadPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/index" element={<IndexPage />} />
          <Route path="/explore-dashboard" element={<ExplorePageDashboard />} />
          <Route
            path="/explore-customquery"
            element={<ExplorePageCustomQuery />}
          />
          <Route path="/sql-examples" element={<SQLExamplesPage />} />
        </Routes>
        <Footer />
      </Router>
    </StoreContext.Provider>
  );
};

export default App;
