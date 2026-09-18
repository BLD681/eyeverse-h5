import { test, expect } from '@playwright/test';

test('portal uses the master visual and exposes four spatial theme nodes', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/#portal');

  await expect(page.locator('.portal')).toHaveClass(/is-ready/);
  await expect(page.getByRole('heading', { name: '视觉之门' })).toBeFocused();
  const image = await page.locator('.portal-image').evaluate((element: HTMLImageElement) => ({ width: element.naturalWidth, height: element.naturalHeight }));
  expect(image).toEqual({ width: 941, height: 1672 });

  const labels = ['DRY EYE，眼中的湖', 'REFRACTION，失焦世界', 'VISION ARCHIVE，视觉档案', 'TIME MIRROR，时间之镜'];
  for (const label of labels) await expect(page.getByRole('button', { name: label })).toBeVisible();
  await page.screenshot({ path: 'test-results/portal-mobile.png' });

  const timeMirror = page.getByRole('button', { name: labels[3] });
  await timeMirror.click();
  await expect(page).toHaveURL(/#time/);
  await page.goBack();
  await expect(page).toHaveURL(/#portal/);

  await page.getByRole('button', { name: labels[1] }).click();
  await expect(page).toHaveURL(/#refraction/);
  await page.goBack();
  await expect(page).toHaveURL(/#portal/);

  await page.getByRole('button', { name: labels[2] }).click();
  await expect(page).toHaveURL(/#archive/);
  await page.goBack();
  await expect(page).toHaveURL(/#portal/);

  await page.getByRole('button', { name: labels[0] }).click();
  await expect(page).toHaveURL(/#dryeye/);
  await page.goBack();
  await expect(page).toHaveURL(/#portal/);

  await page.getByRole('button', { name: '返回首页' }).click();
  await expect(page).toHaveURL(/#home/);
  expect(errors).toEqual([]);
});
