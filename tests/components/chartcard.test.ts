import { describe, test, expect, vi, beforeEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";

vi.resetModules();
vi.stubGlobal(
  "Worker",
  class {
    postMessage() {}
    addEventListener() {}
    removeEventListener() {}
    terminate() {}
  }
);
vi.stubGlobal("localStorage", {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
  clear: () => {}
});

describe("ChartCard Component", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  test("displays spinner when data is loading", async () => {
    const { default: ChartCard } = await import(
      "../../src/components/ChartCard"
    );

    const dashboardElement = {
      sqlQuery: "",
      dashboardStore: {
        activeDateFilterFrom: null,
        activeDateFilterTo: null,
        unselectedAuthors: []
      },
      loadData: vi.fn().mockResolvedValue(undefined),
      chartWidth: "half",
      title: "Test chart",
      description: "Test description",
      dataLoading: true,
      data: null,
      type: "text"
    };

    const html = renderToStaticMarkup(
      createElement(ChartCard, { dashboardElement: dashboardElement })
    );

    expect(html).toContain("Loading");
    expect(html).toContain('aria-label="Loading"');
  });

  test("displays chart content when data is loaded", async () => {
    const { default: ChartCard } = await import(
      "../../src/components/ChartCard"
    );
    const { ChartType, DashboardElement } = await import(
      "../../src/store/DashboardElement"
    );

    const dashboardElement = new DashboardElement(
      "1",
      "Test chart",
      "Test description",
      "half",
      ChartType.TEXT,
      "SELECT 'hello' AS greeting"
    );
    dashboardElement.dataLoading = false;
    dashboardElement.data = [{ greeting: "hello" }];
    dashboardElement.queryTimeMs = 12.3456;

    const html = renderToStaticMarkup(
      createElement(ChartCard, { dashboardElement: dashboardElement })
    );

    expect(html).toContain("Test chart");
    expect(html).toContain("Test description");
    expect(html).toContain("hello");
    expect(html).toContain("12.35 ms");
  });

  test("chart card renders heatmap correctly", async () => {
    const { default: ChartCard } = await import(
      "../../src/components/ChartCard"
    );
    const { ChartType, DashboardElement } = await import(
      "../../src/store/DashboardElement"
    );

    const dashboardElement = new DashboardElement(
      "1",
      "Heatmap chart",
      "Test heatmap description",
      "half",
      ChartType.HEATMAP,
      "SELECT 1"
    );
    dashboardElement.dataLoading = false;
    dashboardElement.data = [{ x: "x", y: "y", value: 5 }];

    const html = renderToStaticMarkup(
      createElement(ChartCard, { dashboardElement: dashboardElement })
    );

    expect(html).toContain("Heatmap chart");
    expect(html).toContain("Test heatmap description");
    expect(html).toContain("echarts-for-react");
  });
});
