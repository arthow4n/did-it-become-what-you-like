import { expect, test } from "@playwright/test";

test("Deno Playwright renders and interacts with one browser page", async ({ page }) => {
  await page.setContent(`
    <!doctype html>
    <html lang="en">
      <body>
        <main>
          <h1>Deno Playwright proof</h1>
          <button type="button">Increment</button>
          <output aria-label="count">Count: 0</output>
        </main>
        <script>
          document.querySelector('button').addEventListener('click', () => {
            document.querySelector('output').textContent = 'Count: 1';
          });
        </script>
      </body>
    </html>
  `);

  await expect(page.getByRole("heading", { name: "Deno Playwright proof" }))
    .toHaveCount(1);
  await page.getByRole("button", { name: "Increment" }).click();
  await expect(page.getByRole("status")).toHaveText("Count: 1");
});
