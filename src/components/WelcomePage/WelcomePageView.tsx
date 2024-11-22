import { Button, Card, Col, Row, Space, theme } from "antd";
import { Typography } from "antd";

const { Title } = Typography;

export function WelcomePageView() {
  return (
    
        <div style={{
            background: "#181818",
            padding: "20px 20px 60px",
            borderRadius: 10,
            margin: "40px 0 20px 0",
          }}
        >
        
        <Row>
            <Col span={12} offset={6}>
                <Title level={1}>Welcome to RepMiner!</Title>
                <Title level={5}>Start by selecting a repository to start the process of analyzing.</Title>
                
            </Col>
        </Row>
        <Row style={{ paddingTop:"20px" }}>
            <Col span={12} offset={6}>
                <Card size={"small"} title="Local Repository">
                        <p>Select the folder containing your Git repository. Your data will remain on your device and will not be uploaded to any server.</p>
                        <Button type="primary">Select Repository</Button>   
                </Card>
            </Col>
        </Row>
        </div>

  );
}
