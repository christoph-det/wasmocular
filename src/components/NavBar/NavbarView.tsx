import { Menu, Image } from "antd";

export function NavigationBarView() {

    return(
        <Menu mode="horizontal" style={{backgroundColor: "#171411", border: 0, paddingTop: 0}}>
            <Image width={25} src="/plattform-logo.webp" preview={false} />
            <span style={{marginLeft: 10, marginRight: 20, fontWeight: 700}}>RepMiner</span>
            <Menu.Item key="home">Home</Menu.Item>
            {/* Displays information about the repo  */}
            <Menu.Item key="repository">Repository</Menu.Item>
            {/* Displays information about the analysis and graphs  */}
            <Menu.Item key="analysis">Analysis</Menu.Item>
        </Menu>
    );

}