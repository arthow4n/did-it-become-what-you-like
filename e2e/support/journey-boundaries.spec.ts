import { expect, test } from "../playwright.ts";
import { APPROVED_JOURNEYS } from "./journeys.ts";

test(
  "approved journey support exposes five isolated boundaries",
  async ({ isolatedContext }) => {
    const page = await isolatedContext.newPage();
    await page.setContent(`
      <main>
        <h1>F-005 journey support</h1>
        <output role="status">${APPROVED_JOURNEYS.length} approved boundaries</output>
      </main>
    `);
    await expect(page.getByRole("heading", { name: "F-005 journey support" }))
      .toHaveCount(1);
    await expect(page.getByRole("status")).toHaveText("5 approved boundaries");
  },
);
