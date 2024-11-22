import { BrowserRouter as Router, Route, Routes } from 'react-router';
import "./App.css";
import { NavigationBar } from "./components/NavBar/NavbarPresenter";
import { WelcomePage } from "./components/WelcomePage/WelcomePagePresenter";
import { ConfigProvider, Layout, theme } from "antd";
import { Content, Footer, Header } from "antd/es/layout/layout";

const App: React.FC = () => {
  // const [count, setCount] = useState(0)
  return (
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: "#e89a3c",
          colorBgBase: "#252525",
          

        },
        algorithm: theme.darkAlgorithm,
      }}
    >
      <>
      <Router>
        <Layout>
            <Header style={{backgroundColor: "#171411"}}>
              <NavigationBar />
            </Header>
            <Content style={{ padding: "0 48px" }}>
              <Routes>
                <Route path="/" element={<WelcomePage />} />
                <Route path="/about" element={<div>About</div>} />
              </Routes>
            </Content>
            <Footer style={{ textAlign: "center" }}>
              TU Wien - Christoph Dethloff (11712604)
            </Footer>
          </Layout>
      </Router>
      </>
    </ConfigProvider>
  );
};

export default App;
