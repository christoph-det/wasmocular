import { describe, test, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";

vi.mock("@/store/StoreContext", () => ({
  useStores: () => ({
    dbStore: {},
    dashboardStore: {
      activeDateFilterFrom: undefined,
      activeDateFilterTo: undefined,
      availableAuthors: new Map([
        ["Alice", true],
        ["Bob", false]
      ])
    },
    indexingStore: {}
  })
}));

import DashboardSidebar from "../../src/components/DashboardSidebar";

describe("DashboardSidebar Component", () => {
  test("renders settings and author filter section", () => {
    const html = renderToStaticMarkup(createElement(DashboardSidebar));

    expect(html).toContain("Dashboard");
    expect(html).toContain("Alice");
    expect(html).toContain("Bob");
  });
});
