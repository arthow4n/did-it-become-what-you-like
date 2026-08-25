import { expect, test } from "./playwright.ts";

test.use({ viewport: { width: 390, height: 844 } });

test(
  "local expenses filters remain separated and within the viewport",
  async ({ isolatedContext }) => {
    const page = await isolatedContext.newPage();
    await page.goto("/");
    await page.getByRole("button", { name: /Create first project/ }).click();
    await page.getByRole("textbox", { name: "Project name" }).fill(
      "Q603 layout",
    );
    await page.getByRole("button", { name: "Save project" }).click();

    const filterBar = page.locator(".local-ui-expenses-filter-bar");
    await expect(filterBar).toBeVisible();
    const geometry = await filterBar.locator(":scope > *").evaluateAll(
      (elements) => {
        const visible = elements.filter((element) => {
          const rect = element.getBoundingClientRect();
          return rect.width > 0 && rect.height > 0;
        });
        const rectangles = visible.map((element) => {
          const rect = element.getBoundingClientRect();
          return {
            left: rect.left,
            right: rect.right,
            top: rect.top,
            bottom: rect.bottom,
          };
        });
        const overlaps = rectangles.flatMap((first, firstIndex) =>
          rectangles.slice(firstIndex + 1).flatMap((second, secondIndex) =>
            first.left < second.right && second.left < first.right &&
              first.top < second.bottom && second.top < first.bottom
              ? [firstIndex, firstIndex + secondIndex + 1]
              : []
          )
        );
        return {
          pageScrollWidth: document.documentElement.scrollWidth,
          viewportWidth: globalThis.innerWidth,
          overlaps: [...new Set(overlaps)],
        };
      },
    );

    expect(geometry.pageScrollWidth).toBeLessThanOrEqual(
      geometry.viewportWidth,
    );
    expect(geometry.overlaps).toEqual([]);
  },
);
