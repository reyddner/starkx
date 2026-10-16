import { expect, test } from "@playwright/test";

/**
 * E2E: exemplo (estaca escavada Ø30 × 8 m) carrega + calcula → armadura → memorial.
 * Valores de referência: tests/fixtures/reference-cases.json (ref-escavada-30).
 * Shell DEC-50: home = Dashboard; criar projeto (diálogo) antes do wizard.
 */
test.describe("STARKX — exemplo de referência", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      try {
        localStorage.removeItem("starkx-project-v2");
        localStorage.removeItem("starkx-library-v1");
      } catch {
        /* ignore */
      }
    });
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Conheça o solo");
    await page.getByRole("link", { name: /Começar gratuitamente/ }).click();
  });

  test("exemplo: Padm, carga usual, armadura e memorial", async ({ page }) => {
    await expect(page.getByRole("link", { name: /STARKX/ })).toBeVisible();
    await expect(page.getByTestId("dashboard-view")).toBeVisible();

    await page.getByTestId("dashboard-new-project").click();
    await expect(page.getByTestId("new-project-dialog")).toBeVisible();
    await page.getByTestId("new-project-name").fill("Exemplo escavada");
    await page.getByTestId("new-project-submit").click();

    await expect(page.getByTestId("step-project")).toBeVisible();
    await expect(page.getByTestId("project-context-bar")).toBeVisible();
    await expect(page.getByTestId("project-context-bar")).toContainText("Exemplo escavada");

    await page.getByTestId("sidebar-load-example").click();
    await expect(page.getByTestId("results-dashboard")).toBeVisible({ timeout: 10000 });
    // média (193,76 + 194,83 + 254,47)/3 = 214,35 ; governante = mínimo = 193,76 kN
    await expect(page.getByTestId("results-padm-average")).toContainText(/214/);
    await expect(page.getByTestId("results-padm-governing")).toContainText(/193/);
    await expect(page.getByTestId("results-nominal")).toContainText(/300/);

    // DEC-58: armadura saiu do menu; abre pelo botão da etapa Capacidade.
    await page.getByTestId("results-open-rebar").click();
    await expect(page.getByTestId("step-rebar")).toBeVisible();
    await page.getByTestId("rebar-run").click();
    await expect(page.getByTestId("rebar-kpi-row")).toBeVisible();
    await expect(page.getByTestId("rebar-as-nec")).toBeVisible();

    await page.getByTestId("nav-step-memorial").click();
    await expect(page.getByTestId("step-memorial")).toBeVisible();
    await expect(page.getByText(/193\.76|Padm|compressão centrada/i).first()).toBeVisible();
  });
});
