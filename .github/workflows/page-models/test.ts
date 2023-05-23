import { Page } from '@playwright/test';
import Chance from 'chance';
import { appSettings } from '../app-settings';

const chance = new Chance();

type Operators = 'eq' | 'gt' | 'gte' | 'lt' | 'lte';

export class ExamUtils {
  //selectors here
  constructor(page: Page) {
    //selectors also here
  }

  async goto(page: Page, path: string) {
    await page.goto(`https://${appSettings.app_identifier}.betty.app${path}`);
    await page.waitForLoadState('networkidle');
  }

}

export class ExamPage {
  //selectors here
  constructor(page: Page) {
    //selectors also here
  }
}
