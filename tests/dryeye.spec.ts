import { test, expect } from '@playwright/test';

async function swipeUp(page: import('@playwright/test').Page) {
  await page.mouse.move(320, 700);
  await page.mouse.down();
  await page.mouse.move(320, 420, { steps: 10 });
  await page.mouse.up();
}

async function swipeDown(page: import('@playwright/test').Page) {
  await page.mouse.move(320, 420);
  await page.mouse.down();
  await page.mouse.move(320, 700, { steps: 10 });
  await page.mouse.up();
}

test('dry eye journey changes one visual through four states and reaches education', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/#dryeye');

  await expect(page.locator('.dryeye')).toHaveClass(/is-ready/);
  const image = await page.locator('.dryeye-image').evaluate((element: HTMLImageElement) => ({ width: element.naturalWidth, height: element.naturalHeight }));
  expect(image).toEqual({ width: 941, height: 1672 });
  await expect(page.getByRole('heading', { name: '眼中的湖' })).toBeVisible();
  await page.screenshot({ path: 'test-results/dryeye-intro-mobile.png' });
  await page.getByRole('button', { name: '进入水膜旅程' }).click();

  const stateControl = page.getByRole('slider', { name: '泪膜状态' });
  await expect(stateControl).toHaveAttribute('aria-valuetext', '健康状态');
  const healthyWaterWidth = (await page.locator('.dryeye-water-sheen').boundingBox())!.width;
  await swipeUp(page);
  await expect(stateControl).toHaveAttribute('aria-valuetext', '疲劳状态');
  await page.getByRole('button', { name: '切换至干涩状态' }).click();
  await expect(stateControl).toHaveAttribute('aria-valuetext', '干涩状态');
  await expect.poll(() => page.locator('.dryeye-dry-veil').evaluate(element => Number(getComputedStyle(element).opacity))).toBeGreaterThan(.5);
  const dryWaterWidth = (await page.locator('.dryeye-water-sheen').boundingBox())!.width;
  expect(dryWaterWidth).toBeLessThan(healthyWaterWidth * .65);
  await expect.poll(() => page.locator('.dryeye-earth-tone').evaluate(element => Number(getComputedStyle(element).opacity))).toBeGreaterThan(.5);
  await expect.poll(() => page.locator('.dryeye-shoreline-exposure').evaluate(element => Number(getComputedStyle(element).opacity))).toBeGreaterThan(.65);
  await page.screenshot({ path: 'test-results/dryeye-dry-mobile.png' });

  await swipeDown(page);
  await expect(stateControl).toHaveAttribute('aria-valuetext', '恢复状态');
  await expect.poll(() => stateControl.getAttribute('aria-valuenow').then(Number)).toBeLessThan(100);
  await page.screenshot({ path: 'test-results/dryeye-restoring-mobile.png' });

  await swipeDown(page);
  await expect.poll(() => stateControl.getAttribute('aria-valuenow').then(Number)).toBeLessThan(45);
  await swipeDown(page);
  await expect.poll(() => stateControl.getAttribute('aria-valuenow').then(Number)).toBeLessThan(12);
  await swipeDown(page);
  await expect(stateControl).toHaveAttribute('aria-valuetext', '恢复状态');
  await expect(stateControl).toHaveAttribute('aria-valuenow', '0');
  await expect.poll(() => page.locator('.dryeye-restore-glow').evaluate(element => Number(getComputedStyle(element).opacity))).toBeGreaterThan(.6);
  await page.screenshot({ path: 'test-results/dryeye-restore-mobile.png' });

  await page.getByRole('button', { name: '了解泪膜健康' }).click();
  await expect(page.getByRole('heading', { name: /让眼中的湖/ })).toBeVisible();
  await expect(page.getByText('干眼不适常与泪膜稳定性变化有关。')).toBeVisible();
  await page.screenshot({ path: 'test-results/dryeye-science-mobile.png' });
  await page.getByRole('button', { name: '返回视觉之门' }).click();
  await expect(page).toHaveURL(/#portal/);
  expect(errors).toEqual([]);
});
