import { test, expect, type Page } from '@playwright/test';

async function enterTopic(page: Page, nodeName: string, hash: string, selector: string) {
  await page.getByRole('button', { name: nodeName }).click();
  await expect(page).toHaveURL(new RegExp(`#${hash}`));
  await expect(page.locator(selector)).toHaveClass(/is-ready/);
  await expect(page.locator('.optical-transition')).toHaveCount(0);
}

async function returnFromIntro(page: Page, backSelector: string, oldSelector: string) {
  await page.locator(backSelector).click();
  await expect(page).toHaveURL(/#portal/);
  await expect(page.locator('.optical-transition')).toHaveCount(0);
  await expect(page.locator(oldSelector)).toHaveCount(0);
  await expect(page.locator('.portal')).toHaveClass(/is-ready/);
}

test('topic sessions fully unmount and reopen from their initial state', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/#portal');
  await expect(page.locator('.portal')).toHaveClass(/is-ready/);

  await enterTopic(page, 'DRY EYE，眼中的湖', 'dryeye', '.dryeye');
  await page.locator('.dryeye-enter').click();
  await page.getByRole('button', { name: '切换至干涩状态' }).click();
  await expect(page.getByRole('slider', { name: '泪膜状态' })).toHaveAttribute('aria-valuenow', '100');
  await page.locator('.dryeye-back').click();
  await returnFromIntro(page, '.dryeye-back', '.dryeye');

  await enterTopic(page, 'DRY EYE，眼中的湖', 'dryeye', '.dryeye');
  await expect(page.getByRole('heading', { name: '眼中的湖' })).toBeVisible();
  await page.locator('.dryeye-enter').click();
  await expect(page.getByRole('slider', { name: '泪膜状态' })).toHaveAttribute('aria-valuenow', '0');
  await page.locator('.dryeye-back').click();
  await returnFromIntro(page, '.dryeye-back', '.dryeye');

  await enterTopic(page, 'REFRACTION，失焦世界', 'refraction', '.refraction');
  await returnFromIntro(page, '.refraction-back', '.refraction');

  await enterTopic(page, 'VISION ARCHIVE，视觉档案', 'archive', '.archive');
  await page.locator('.archive-enter').click();
  const hold = page.locator('.archive-hold');
  const holdBox = await hold.boundingBox();
  if (!holdBox) throw new Error('Archive hold control is not visible');
  await page.mouse.move(holdBox.x + holdBox.width / 2, holdBox.y + holdBox.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(180);
  await page.locator('.archive-back').evaluate((button: HTMLButtonElement) => button.click());
  await page.mouse.up();
  await returnFromIntro(page, '.archive-back', '.archive');

  await enterTopic(page, 'TIME MIRROR，时间之镜', 'time', '.time-mirror');
  await returnFromIntro(page, '.time-back', '.time-mirror');

  expect(errors).toEqual([]);
});
