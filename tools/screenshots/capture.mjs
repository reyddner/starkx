/**
 * Capturas de tela do guia (docs/GUIA.md) e PDFs de exemplo, a partir do app rodando.
 *
 *   node tools/screenshots/capture.mjs [URL] [pasta-imagens] [pasta-pdfs]
 *
 * Padrões: https://starkx-publico.vercel.app · docs/img · docs/exemplos
 * Requer o Chromium do Playwright (npx playwright install chromium).
 */
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

const baseUrl = process.argv[2] ?? "https://starkx-publico.vercel.app";
const outDir = process.argv[3] ?? "docs/img";
const pdfDir = process.argv[4] ?? "docs/exemplos";
mkdirSync(outDir, { recursive: true });
mkdirSync(pdfDir, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({
  acceptDownloads: true,
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 1,
  locale: "pt-BR",
});
await page.addInitScript(() => {
  try {
    localStorage.removeItem("starkx-project-v2");
    localStorage.removeItem("starkx-library-v1");
  } catch {
    /* sem storage: segue */
  }
});

const shot = async (name) => {
  // O app guarda a rolagem entre etapas: cada foto começa do topo.
  await page.evaluate(() => {
    window.scrollTo(0, 0);
    for (const el of document.querySelectorAll("*")) if (el.scrollTop > 0) el.scrollTop = 0;
  });
  await page.waitForTimeout(700);
  await page.screenshot({ path: join(outDir, `${name}.png`) });
  console.log(`ok ${name}.png`);
};
const step = async (id, name) => {
  const nav = page.getByTestId(`nav-step-${id}`);
  if ((await nav.count()) === 0) {
    console.log(`(sem etapa ${id})`);
    return;
  }
  await nav.click();
  await page.getByTestId(`step-${id}`).waitFor({ timeout: 15000 }).catch(() => {});
  await shot(name);
};

await page.goto(baseUrl);
await page.getByRole("heading", { level: 1 }).waitFor();
await shot("00-inicio");

await page.getByRole("link", { name: /Começar gratuitamente/ }).click();
await page.getByTestId("dashboard-view").waitFor();
await page.getByTestId("dashboard-new-project").click();
await page.getByTestId("new-project-name").fill("Exemplo — estaca escavada");
await shot("01-novo-projeto");
await page.getByTestId("new-project-submit").click();
await page.getByTestId("step-project").waitFor();

await page.getByTestId("sidebar-load-example").click();
await page.getByTestId("results-dashboard").waitFor({ timeout: 15000 });

await step("project", "02-dados-da-obra");
await step("borehole", "03-sondagem");
await step("loads", "04-cargas");
await step("analysis", "05-analise");
await step("foundation", "06-fundacao");
await step("results", "07-capacidade");
// Vista 3D da estaca no perfil de sondagem (painel da direita).
await page.getByRole("button", { name: "3D", exact: true }).click();
await page.locator("canvas").first().waitFor({ timeout: 20000 });
await page.waitForTimeout(2500);
await shot("07b-vista-3d");
await page.getByRole("button", { name: "2D", exact: true }).click();
await step("block", "08-bloco");
await step("drawings", "09-desenhos");
const download = async (click, file) => {
  const [dl] = await Promise.all([page.waitForEvent("download", { timeout: 60000 }), click()]);
  await dl.saveAs(join(pdfDir, file));
  console.log(`ok ${file}`);
};
await download(() => page.getByTestId("btn-download-pdf-book").click(), "exemplo-pranchas.pdf");
await step("memorial", "10-memorial");
await download(() => page.getByRole("button", { name: "Baixar PDF" }).click(), "exemplo-memorial.pdf");

await browser.close();
