import { test, expect, type Page } from '@playwright/test';

async function enter(page: Page, node: string, hash: string) {
  await page.getByRole('button', { name: node }).click();
  await expect(page).toHaveURL(new RegExp(`#${hash}`));
  await expect(page.locator('.optical-transition')).toHaveCount(0);
}

async function expectProgress(page: Page, count: number) {
  await expect(page.getByLabel(`探索进度 ${count} / 4`)).toBeVisible();
}

test('completed branches evolve the portal and unlock Vision Core', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/#portal');
  await expectProgress(page, 0);

  await enter(page, 'DRY EYE，眼中的湖', 'dryeye');
  await page.locator('.dryeye-enter').click();
  await page.getByRole('button', { name: '切换至恢复状态' }).click();
  await page.locator('.dryeye-science-link').click();
  await page.locator('.dryeye-finish').click();
  await expect(page).toHaveURL(/#portal/);
  await expectProgress(page, 1);
  await expect(page.locator('.portal-node--dry-eye')).toHaveClass(/is-complete/);

  await enter(page, 'REFRACTION，失焦世界', 'refraction');
  await page.locator('.refraction-enter').click();
  await page.getByRole('button', { name: '切换至重新聚焦状态' }).click();
  await page.locator('.refraction-science-link').click();
  await page.locator('.refraction-finish').click();
  await expect(page).toHaveURL(/#portal/);
  await expectProgress(page, 2);
  await expect(page.locator('.eye-within')).toHaveCount(0);

  await enter(page, 'VISION ARCHIVE，视觉档案', 'archive');
  await page.locator('.archive-enter').click();
  const hold = page.locator('.archive-hold');
  const box = await hold.boundingBox();
  if (!box) throw new Error('Archive hold control is not visible');
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(3750);
  await page.mouse.up();
  await expect(page.locator('.archive-result')).toBeVisible();
  await page.locator('.archive-finish').click();
  await expect(page).toHaveURL(/#portal/);
  await expectProgress(page, 3);
  await expect(page.locator('.eye-within')).toHaveCount(1);
  await expect(page.locator('.eye-within-video')).toHaveAttribute('src', /eyeverse_page3_mobile\.mp4\?v=20260916-021944$/);

  await enter(page, 'TIME MIRROR，时间之镜', 'time');
  await page.locator('.time-enter').click();
  await page.getByRole('button', { name: '切换至平衡恢复状态' }).click();
  await page.locator('.time-care-link').click();
  await page.locator('.time-finish').click();
  await expect(page).toHaveURL(/#portal/);
  await expectProgress(page, 4);
  await expect(page.locator('.portal')).toHaveClass(/is-evolved/);
  const finaleEntry = page.getByRole('button', { name: /ENTER THE EYE WITHIN/ });
  await expect(finaleEntry).toBeVisible();
  await expect(finaleEntry).toBeEnabled({ timeout: 15000 });
  await page.screenshot({ path: 'test-results/portal-evolved-mobile.png' });

  await finaleEntry.click();
  await expect(page).toHaveURL(/#the-eye-within/, { timeout: 10000 });
  await expect(page.locator('.eye-within-video')).toBeVisible();
  await page.screenshot({ path: 'test-results/vision-core-mobile.png' });
  expect(errors).toEqual([]);
});

