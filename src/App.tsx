import { HashRouter as Router, Route, Routes } from "react-router-dom";
import "./App.css";
import { NavigationBar } from "./components/NavBar/NavbarPresenter";
import { IndexPage } from "./components/IndexPage/IndexPagePresenter";
import { LoadPage } from "./components/LoadPage/LoadPagePresenter";

const App: React.FC = () => {
  // const [count, setCount] = useState(0)
  return (
    <Router>
      <NavigationBar />
      <Routes>
        <Route path="/" element={<LoadPage />} />
        <Route path="/index" element={<IndexPage />} />
        <Route path="/about" element={<div>About</div>} />
      </Routes>
      <div className="text-center text-gray-500 text-sm mt-5">
        TU Wien - Christoph Dethloff (11712604)
      </div>
    </Router>
  );
};

export default App;
