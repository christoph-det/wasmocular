import { afterEach, describe, expect, test, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("@/store/StoreContext", () => ({
  useStores: () => ({
    indexingStore: {
      dataLoadingState: "INDEXING_FINISHED",
      project: null
    }
  })
}));

vi.mock("../../src/components/LoadOtherProjectDialog.tsx", () => ({
  default: () => createElement("div", null, "Load Dialog")
}));

function mockWindowHash(hash: string) {
  vi.stubGlobal("window", {
    location: { hash }
  });
}

import NavigationBar from "../../src/components/NavigationBar";

describe("NavigationBar Component", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("renders brand and load existing project action", () => {
    mockWindowHash("#/");

    const html = renderToStaticMarkup(createElement(NavigationBar));

    expect(html).toContain("WasmOcular");
    expect(html).toContain("✅ LOAD");
    expect(html).toContain("INDEX");
    expect(html).toContain("EXPLORE");
    expect(html).toContain("Load Existing Project");
  });
});
