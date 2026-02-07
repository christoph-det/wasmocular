import { describe, test, expect, vi, afterEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import ExploreNavigationBar from "../../src/components/ExploreNavigationBar";

function mockWindowHash(hash: string) {
  vi.stubGlobal("window", {
    location: { hash }
  });
}

describe("ExploreNavigationBar Component", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("renders both navigation links", () => {
    mockWindowHash("#explore-dashboard");

    const html = renderToStaticMarkup(createElement(ExploreNavigationBar));

    expect(html).toContain('href="#explore-customquery"');
    expect(html).toContain('href="#explore-dashboard"');
  });

  test("marks dashboard link as active when hash is #explore-dashboard", () => {
    mockWindowHash("#explore-dashboard");

    const html = renderToStaticMarkup(createElement(ExploreNavigationBar));

    expect(html).toContain(
      'href="#explore-dashboard" class="mx-4 transition-colors duration-150 hover:text-blue-700 hover:border-b focus:text-blue-900 border-b"'
    );
  });
});
