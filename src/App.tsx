import { HashRouter as Router, Route, Routes } from "react-router-dom";
import "./App.css";
import NavigationBar from "./components/NavigationBar";
import IndexPage from "./pages/IndexPage";
import LoadPage from "./pages/LoadPage";
import ExplorePage from "./pages/ExplorePage";
import Footer from "./components/Footer";
import { StoreContext, rootStore } from './store/StoreContext';

const App: React.FC = () => {
  // const [count, setCount] = useState(0)
  return (<StoreContext.Provider value={rootStore}>
    <Router>
      <NavigationBar />
      <Routes>
        <Route path="/" element={<LoadPage />} />
        <Route path="/index" element={<IndexPage />} />
        <Route path="/explore" element={<ExplorePage />} />
      </Routes>
      <Footer />
    </Router>
  </StoreContext.Provider>
  );
};

export default App;
