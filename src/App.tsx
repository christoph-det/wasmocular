import { HashRouter as Router, Route, Routes } from "react-router-dom";
import "./App.css";
import NavigationBar from "./components/NavigationBar";
import IndexPage from "./pages/IndexPage";
import LoadPage from "./pages/LoadPage";
import Footer from "./components/Footer";
import { StoreContext, rootStore } from "./store/StoreContext";
import ExplorePageDashboard from "./pages/ExplorePageDashboard";
import ExplorePageCustomQuery from "./pages/ExplorePageCustomQuery";

const App: React.FC = () => {
  return (
    <StoreContext.Provider value={rootStore}>
      <Router>
        <NavigationBar />
        <Routes>
          <Route path="/" element={<LoadPage />} />
          <Route path="/index" element={<IndexPage />} />
          <Route path="/explore-dashboard" element={<ExplorePageDashboard />} />
          <Route
            path="/explore-customquery"
            element={<ExplorePageCustomQuery />}
          />
        </Routes>
        <Footer />
      </Router>
    </StoreContext.Provider>
  );
};

export default App;
