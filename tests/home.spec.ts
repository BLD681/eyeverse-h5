import { test, expect } from '@playwright/test';

test('mobile home keeps art intact and navigates through pupil transition', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.locator('.home')).toHaveClass(/is-ready/);
  await expect(page.getByRole('button', { name: '开始探索' })).toBeDisabled();
  await page.waitForTimeout(3350);
  const lidAnimation = await page.locator('.optical-lid--top').evaluate(element => getComputedStyle(element).animationName);
  expect(lidAnimation).toContain('optical-blink-top');
  await page.screenshot({ path: 'test-results/home-awakening-blink.png' });
  await page.waitForTimeout(1800);
  await expect(page.getByRole('heading', { name: 'EYEVERSE' })).toBeVisible();
  const image = await page.locator('.hero-image').evaluate((img: HTMLImageElement) => ({ w: img.naturalWidth, h: img.naturalHeight }));
  expect(image.w / image.h).toBeCloseTo(9 / 16, 2);
  await page.screenshot({ path: 'test-results/home-mobile.png' });
  await page.getByRole('button', { name: '开始探索' }).click();
  await expect(page.locator('.home')).toHaveClass(/is-exiting/);
  await page.waitForTimeout(650);
  await page.screenshot({ path: 'test-results/home-enter-focus.png' });
  await page.waitForTimeout(850);
  await page.screenshot({ path: 'test-results/home-enter-depth.png' });
  await expect(page).toHaveURL(/#portal/);
  await expect(page.getByRole('heading', { name: '视觉之门' })).toBeFocused();
  await page.getByRole('button', { name: '返回首页' }).click();
  await expect(page.getByRole('heading', { name: 'EYEVERSE' })).toBeVisible();
  await expect(page.locator('.home')).toHaveClass(/is-returning/);
  await expect(page.getByRole('button', { name: '开始探索' })).toBeEnabled();
  expect(errors).toEqual([]);
});

test('viewport sizes and reduced motion preserve safe controls', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const [width, height] of [[360, 640], [320, 568], [430, 932], [1440, 900], [844, 390]]) {
    await page.setViewportSize({ width, height });
    await page.goto('/');
    const button = page.getByRole('button', { name: '开始探索' });
    await expect(button).toBeEnabled();
    const box = await button.boundingBox();
    expect(box!.y).toBeGreaterThan(0);
    expect(box!.y + box!.height).toBeLessThanOrEqual(height);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `test-results/home-${width}x${height}.png` });
  }
  await page.getByRole('button', { name: '开始探索' }).click();
  await expect(page).toHaveURL(/#portal/);
  await page.goBack();
  await expect(page.getByRole('button', { name: '开始探索' })).toBeEnabled();
});
