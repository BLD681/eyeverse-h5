import { test, expect, type Page } from '@playwright/test';

async function swipeLeft(page: Page) {
  await page.mouse.move(330, 510);
  await page.mouse.down();
  await page.mouse.move(65, 510, { steps: 10 });
  await page.mouse.up();
}

async function swipeRight(page: Page) {
  await page.mouse.move(65, 510);
  await page.mouse.down();
  await page.mouse.move(330, 510, { steps: 10 });
  await page.mouse.up();
}

test('refraction journey shifts focus, adds restrained astigmatic optics, and refocuses', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/#refraction');

  await expect(page.locator('.refraction')).toHaveClass(/is-ready/);
  const image = await page.locator('.refraction-image--base').evaluate((element: HTMLImageElement) => ({ width: element.naturalWidth, height: element.naturalHeight }));
  expect(image).toEqual({ width: 941, height: 1672 });
  await expect(page.locator('.refraction-image')).toHaveCount(3);
  await expect(page.getByRole('heading', { name: '失焦世界' })).toBeVisible();
  await page.screenshot({ path: 'test-results/refraction-intro-mobile.png' });
  await page.getByRole('button', { name: '进入焦距体验' }).click();

  const focusControl = page.getByRole('slider', { name: '焦距状态' });
  await expect(focusControl).toHaveAttribute('aria-valuetext', '清晰状态');
  await swipeLeft(page);
  await expect(focusControl).toHaveAttribute('aria-valuetext', '明显失焦状态');

  await page.getByRole('button', { name: '切换至散光感状态' }).click();
  await expect(focusControl).toHaveAttribute('aria-valuetext', '散光感状态');
  await expect(focusControl).toHaveAttribute('aria-valuenow', '100');
  await expect.poll(() => page.locator('.refraction-image--ghost-a').evaluate(element => Number(getComputedStyle(element).opacity))).toBeGreaterThan(.2);
  await expect.poll(() => page.locator('.refraction-streaks').evaluate(element => Number(getComputedStyle(element).opacity))).toBeGreaterThan(.25);
  const blur = await page.locator('.refraction-image--base').evaluate(element => getComputedStyle(element).filter);
  expect(blur).toContain('blur(4.6px)');
  await page.screenshot({ path: 'test-results/refraction-astigmatic-mobile.png' });

  await swipeRight(page);
  await expect(focusControl).toHaveAttribute('aria-valuetext', '重新聚焦状态');
  await expect.poll(() => focusControl.getAttribute('aria-valuenow').then(Number)).toBeLessThan(100);
  await swipeRight(page);
  await expect.poll(() => focusControl.getAttribute('aria-valuenow').then(Number)).toBeLessThan(15);
  await swipeRight(page);
  await expect(focusControl).toHaveAttribute('aria-valuenow', '0');
  await expect.poll(() => page.locator('.refraction-refocus-wave').evaluate(element => Number(getComputedStyle(element).opacity))).toBeGreaterThan(.55);
  await page.screenshot({ path: 'test-results/refraction-refocused-mobile.png' });

  await page.getByRole('button', { name: '了解屈光健康' }).click();
  await expect(page.getByRole('heading', { name: /让焦点/ })).toBeVisible();
  await expect(page.getByText('近视、远视和散光都可能改变光线在眼内的聚焦方式。')).toBeVisible();
  await page.screenshot({ path: 'test-results/refraction-science-mobile.png' });
  await page.getByRole('button', { name: '返回视觉之门' }).click();
  await expect(page).toHaveURL(/#portal/);
  expect(errors).toEqual([]);
});
