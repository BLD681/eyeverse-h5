import { test, expect, type Page } from '@playwright/test';

async function swipeRight(page: Page) {
  await page.mouse.move(60, 510);
  await page.mouse.down();
  await page.mouse.move(330, 510, { steps: 10 });
  await page.mouse.up();
}

test('time mirror reveals warm traces and settles into a balanced state', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/#time');

  await expect(page.locator('.time-mirror')).toHaveClass(/is-ready/);
  const image = await page.locator('.time-image--base').evaluate((element: HTMLImageElement) => ({ width: element.naturalWidth, height: element.naturalHeight }));
  expect(image).toEqual({ width: 941, height: 1672 });
  await expect(page.getByRole('heading', { name: '时间之镜' })).toBeVisible();
  await page.screenshot({ path: 'test-results/time-intro-mobile.png' });
  await page.getByRole('button', { name: '进入时间轨迹' }).click();

  const timeline = page.getByRole('slider', { name: '眼周时间状态' });
  await expect(timeline).toHaveAttribute('aria-valuetext', '清新状态');
  await swipeRight(page);
  await expect(timeline).toHaveAttribute('aria-valuetext', '时间痕迹状态');
  await expect.poll(() => page.locator('.time-image--warm').evaluate(element => Number(getComputedStyle(element).opacity))).toBeGreaterThan(.4);
  await expect.poll(() => page.locator('.time-texture').evaluate(element => Number(getComputedStyle(element).opacity))).toBeGreaterThan(.45);
  await page.screenshot({ path: 'test-results/time-trace-mobile.png' });

  await page.getByRole('button', { name: '切换至平衡恢复状态' }).click();
  await expect(timeline).toHaveAttribute('aria-valuetext', '平衡恢复状态');
  await expect(timeline).toHaveAttribute('aria-valuenow', '100');
  await expect.poll(() => page.locator('.time-balance-wave').evaluate(element => Number(getComputedStyle(element).opacity))).toBeGreaterThan(.65);
  await page.screenshot({ path: 'test-results/time-balance-mobile.png' });

  await page.getByRole('button', { name: '查看平衡建议' }).click();
  await expect(page.getByRole('heading', { name: /与时间/ })).toBeVisible();
  await expect(page.getByText('稳定的照护，比追赶时间更重要。', { exact: false })).toBeVisible();
  await page.screenshot({ path: 'test-results/time-care-mobile.png' });
  await page.getByRole('button', { name: '返回视觉之门' }).click();
  await expect(page).toHaveURL(/#portal/);
  expect(errors).toEqual([]);
});
