import test, { expect } from '@playwright/test';
import { Chance } from '@playwright/test';
import { ExamUtils } from '@playwright/test';
import { appSettings } from '@playwright/test';

const chance = new Chance();

test.describe('case management', async () => {
    test('As a web user, I am able to add a new case', async ({
      page,
    }) => {
      const loginUtils = new ExamUtils(page);  
      await loginUtils.goto(page, '/login');
      expect(page.url()).toMatch('/login');
      await page.type('[data-component="EmailField"] input', "ehab@test.com");
      await page.type('[data-component="Password"] input', "Welkom01");
      await page.click('button[type="submit"]');
      await page.waitForTimeout(9000);
      const caseoverviewUtils = new ExamUtils(page);
      await caseoverviewUtils.goto(page, '/case-overview');
      await page.waitForTimeout(3000);
      expect(page.url()).toMatch('/case-overview');

      await page.click('[data-component="Button-open-drawer"]');
      await page.waitForTimeout(2000);
      await page.type('[data-component="Number-case-number"] input', ('8073102123'));
      await page.waitForTimeout(2000);
      await page.type('[data-component="TextField-case-title"] input', "Automated testing title case.");
      await page.waitForTimeout(2000);
      await page.type('[data-component="TextField-description"] textarea', "Automated testing description case.Automated testing description case.");
      await page.waitForTimeout(2000);
      await page.locator('[data-component="select-box"]').locator("div").first().click();
      await page.waitForTimeout(2000);
      await page.keyboard.down('ArrowDown');
      await page.waitForTimeout(2000);
      await page.keyboard.press('Enter');
      await page.waitForTimeout(2000);
      await page.locator('[data-component="select-box2"]').locator("div").first().click();
      await page.waitForTimeout(2000);
      await page.keyboard.down('ArrowDown');
      await page.waitForTimeout(2000);
      await page.keyboard.press('Enter');
      await page.waitForTimeout(2000);
      await page.click('[data-component="Button-add-case"]');
      await page.waitForTimeout(3000);
      
    });

    test('As a web user, I am able to update a case', async ({
        page,
      }) => {
      const loginUtils = new ExamUtils(page);  
      await loginUtils.goto(page, '/login');
      expect(page.url()).toMatch('/login');
      await page.type('[data-component="EmailField"] input', "ehab@test.com");
      await page.type('[data-component="Password"] input', "Welkom01");
      await page.click('button[type="submit"]');
      await page.waitForTimeout(9000);
      const caseoverviewUtils = new ExamUtils(page);
      await caseoverviewUtils.goto(page, '/case-overview');
      await page.waitForTimeout(1000);
      expect(page.url()).toMatch('/case-overview');

      await page.locator('[data-component="Box-card-details"]').first().click();
      await page.waitForTimeout(2000);
      await page.type('[data-component="Update-case-number"] input', ('80736038634'));
      await page.waitForTimeout(2000);
      await page.type('[data-component="Update-case-title"] input', "Automated updated testing title case.");
      await page.waitForTimeout(2000);
      await page.type('[data-component="Update-case-description"] textarea', "Automated testing updated description case.Automated updated testing description case.");
      await page.waitForTimeout(2000);
      await page.locator('[data-component="Update-select-box"]').locator("div").first().click();
      await page.waitForTimeout(2000);
      await page.keyboard.down('ArrowDown');
      await page.waitForTimeout(2000);
      await page.keyboard.down('ArrowDown');
      await page.waitForTimeout(2000);
      await page.keyboard.press('Enter');
      await page.waitForTimeout(2000);
      await page.locator('[data-component="Update-select-box2"]').locator("div").first().click();
      await page.waitForTimeout(2000);
      await page.keyboard.down('ArrowDown');
      await page.waitForTimeout(2000);
      await page.keyboard.press('Enter');
      await page.waitForTimeout(2000);
      await page.click('[data-component="Button-update-case"]');
      await page.waitForTimeout(3000);

      });

     test('As a web user, I am able to delete a document', async ({
    page,
  }) => {
    const loginUtils = new ExamUtils(page);  
    await loginUtils.goto(page, '/login');
    expect(page.url()).toMatch('/login');
    await page.type('[data-component="EmailField"] input', "ehab@test.com");
    await page.type('[data-component="Password"] input', "Welkom01");
    await page.click('button[type="submit"]');
    await page.waitForTimeout(9000);
    const caseoverviewUtils = new ExamUtils(page);
    await caseoverviewUtils.goto(page, '/case-overview');

    await page.waitForTimeout(3000);
    expect(page.url()).toMatch('/case-overview');
    await page.locator('[data-component="Button-card-details"]');
    await page.click('[data-component="Button-delete-case"]');
    await page.waitForTimeout(3000);
    await page.locator('[data-component="Box-delete-case"]').locator("button").first().click();
    await page.waitForTimeout(4000);
  }); 

});
