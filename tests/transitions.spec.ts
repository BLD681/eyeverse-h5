import { test, expect } from '@playwright/test';

test('shared optical transition connects portal, topic, and reverse return', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/#portal');
  await expect(page.locator('.portal')).toHaveClass(/is-ready/);
  const sound = page.getByRole('button', { name: '关闭环境声音' });
  await expect(sound).toHaveAttribute('aria-pressed', 'true');
  await sound.click();
  await expect(page.getByRole('button', { name: '开启环境声音' })).toHaveAttribute('aria-pressed', 'false');
  await page.getByRole('button', { name: '开启环境声音' }).click();

  await page.getByRole('button', { name: 'TIME MIRROR，时间之镜' }).click();
  await expect(page.locator('.experience')).toHaveClass(/is-portal-to-topic/);
  await expect(page.locator('.optical-transition--portal-to-topic')).toBeVisible();
  await expect(page.locator('.portal')).toHaveCount(1);
  await expect(page.locator('.time-mirror')).toHaveCount(1);
  await expect(page).toHaveURL(/#portal/);
  await page.waitForTimeout(650);
  await expect(page.locator('.portal')).toBeVisible();
  await page.screenshot({ path: 'test-results/transition-portal-to-topic.png' });

  await expect(page).toHaveURL(/#time/, { timeout: 1200 });
  await expect(page.locator('.time-mirror')).toBeVisible();
  await expect(page.locator('.time-image')).toHaveCount(2);
  await expect(page.locator('.optical-transition')).toHaveCount(0, { timeout: 1000 });

  await page.getByRole('button', { name: '返回' }).click();
  await expect(page.locator('.experience')).toHaveClass(/is-topic-to-portal/);
  await expect(page.locator('.optical-transition--topic-to-portal')).toBeVisible();
  await expect(page.locator('.time-mirror')).toHaveCount(1);
  await expect(page.locator('.portal')).toHaveCount(1);
  await page.waitForTimeout(520);
  await expect(page.locator('.time-mirror')).toBeVisible();
  await page.screenshot({ path: 'test-results/transition-topic-to-portal.png' });

  await expect(page).toHaveURL(/#portal/, { timeout: 1200 });
  await expect(page.locator('.portal--from-topic')).toBeVisible();
  await expect(page.locator('.optical-transition')).toHaveCount(0, { timeout: 1000 });
  expect(errors).toEqual([]);
});
