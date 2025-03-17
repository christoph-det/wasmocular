import { BrowserRouter as Router, Route, Routes } from "react-router-dom";
import "./App.css";
import { NavigationBar } from "./components/NavBar/NavbarPresenter";
import { WelcomePage } from "./components/WelcomePage/WelcomePagePresenter";

const App: React.FC = () => {
  // const [count, setCount] = useState(0)
  return (
    <Router>
      <NavigationBar />
      <Routes>
        <Route path="/" element={<WelcomePage />} />
        <Route path="/about" element={<div>About</div>} />
      </Routes>
      <div className="text-center text-gray-500 text-sm mt-5">
        TU Wien - Christoph Dethloff (11712604)
      </div>
    </Router>
  );
};

export default App;
