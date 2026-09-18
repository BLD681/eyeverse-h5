import { test, expect } from '@playwright/test';

test('vision archive completes a layered long-press scan and creates a non-diagnostic summary', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/#archive');

  await expect(page.locator('.archive')).toHaveClass(/is-ready/);
  const image = await page.locator('.archive-image--base').evaluate((element: HTMLImageElement) => ({ width: element.naturalWidth, height: element.naturalHeight }));
  expect(image).toEqual({ width: 941, height: 1672 });
  await expect(page.locator('.archive-image')).toHaveCount(3);
  await expect(page.getByRole('heading', { name: '视觉档案' })).toBeVisible();
  await page.screenshot({ path: 'test-results/archive-intro-mobile.png' });
  await page.getByRole('button', { name: '进入视觉扫描' }).click();

  const hold = page.getByRole('button', { name: '长按开始扫描' });
  await hold.dispatchEvent('pointerdown', { pointerId: 1, pointerType: 'touch', isPrimary: true });
  await page.waitForTimeout(1900);
  const midProgress = Number(await hold.getAttribute('aria-valuenow'));
  expect(midProgress).toBeGreaterThan(35);
  expect(midProgress).toBeLessThan(75);
  await expect.poll(() => page.locator('.archive-traces').evaluate(element => Number(getComputedStyle(element).opacity))).toBeGreaterThan(.35);
  const lensTransform = await page.locator('.archive-image--lens-shell').evaluate(element => getComputedStyle(element).transform);
  expect(lensTransform).not.toBe('none');
  await page.screenshot({ path: 'test-results/archive-scanning-mobile.png' });

  await page.waitForTimeout(1900);
  await expect(hold).toHaveAttribute('aria-valuenow', '100');
  await expect(page.getByRole('heading', { name: '视觉档案摘要' })).toBeVisible({ timeout: 2500 });
  await expect(page.getByText('记录已完成。以下内容是日常健康提醒，不构成医学诊断。')).toBeVisible();
  await expect(page.getByRole('heading', { name: '用眼习惯' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '视觉疲劳提醒' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '检查建议' })).toBeVisible();
  await page.screenshot({ path: 'test-results/archive-result-mobile.png' });

  await page.getByRole('button', { name: '保存体验 · 返回视觉之门' }).click();
  await expect(page).toHaveURL(/#portal/);
  expect(errors).toEqual([]);
});
