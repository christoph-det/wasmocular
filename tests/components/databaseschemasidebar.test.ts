// @vitest-environment jsdom
import { describe, test, expect, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { render, screen } from "@testing-library/react";
import DatabaseSchemaSidebar from "../../src/components/DatabaseSchemaSidebar";

vi.mock("@/store/StoreContext", () => ({
  useStores: () => ({
    dbStore: {
      getTableAndColumnNames: vi.fn().mockResolvedValue({
        commits: [{ column_name: "author_signature", data_type: "VARCHAR" }]
      }),
      tablesAndColumns: {}
    },
    indexingStore: {
      project: {
        repositoryIdentifier: "owner/repo"
      }
    }
  })
}));

vi.mock("@/hooks/useToast", () => ({
  useToast: () => ({ showError: vi.fn() })
}));

describe("DatabaseSchemaSidebar Component", () => {
  test("renders schema title, description and loading spinner initially", () => {
    const sidebar = createElement(DatabaseSchemaSidebar);
    const html = renderToStaticMarkup(sidebar);

    expect(html).toContain("Data Schema");
    expect(html).toContain('aria-label="Loading"');
  });

  test("shows commits after loading finishes", async () => {
    render(createElement(DatabaseSchemaSidebar));

    expect(screen.getByLabelText("Loading")).toBeTruthy();

    expect(await screen.findByText("commits")).toBeTruthy();
  });
});
