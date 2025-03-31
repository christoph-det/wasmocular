import { HashRouter as Router, Route, Routes } from "react-router-dom";
import "./App.css";
import NavigationBar from "./components/NavBar/NavigationBar";
import IndexPage from "./pages/IndexPage";
import LoadPage from "./pages/LoadPage";
import ExplorePage from "./pages/ExplorePage";

const App: React.FC = () => {
  // const [count, setCount] = useState(0)
  return (
    <Router>
      <NavigationBar />
      <Routes>
        <Route path="/" element={<LoadPage />} />
        <Route path="/index" element={<IndexPage />} />
        <Route path="/explore" element={<ExplorePage />} />
      </Routes>
      <div className="text-center text-gray-500 text-sm mt-5">
        TU Wien - Christoph Dethloff (11712604)
      </div>
    </Router>
  );
};

export default App;
