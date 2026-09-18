import { test, expect } from '@playwright/test';

test('finale hands the video ending to the interactive earth and final message', async ({ page }) => {
  await page.goto('/#the-eye-within');
  const finale = page.locator('.eye-within');
  await expect(finale).toBeVisible();
  await expect(page.locator('.eye-within-video')).toHaveAttribute('poster', /eyeverse_page3_poster\.jpg$/);

  await expect(finale).toHaveClass(/eye-within--ready/, { timeout: 3000 });
  await page.getByRole('button', { name: '触碰世界' }).click();
  await expect(finale).toHaveClass(/eye-within--final/, { timeout: 3000 });
  await expect(page.getByRole('heading', { name: /在看见世界之前/ })).toBeVisible();
  await expect(page.getByAltText('爱尔眼科 Aier Ophthalmology')).toBeVisible();
});
