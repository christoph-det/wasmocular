import { describe, test, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import Footer from "../../src/components/Footer";

describe("Footer Component", () => {
  test("renders thesis information text", () => {
    const html = renderToStaticMarkup(createElement(Footer));

    expect(html).toContain("TU Wien - Master Thesis");
    expect(html).toContain("Christoph Dethloff");
  });
});
