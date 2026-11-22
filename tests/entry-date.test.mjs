import assert from 'node:assert/strict';
import test from 'node:test';

test('Add entry refreshes its date after viewing-period dates change', {skip: !process.env.BASE_URL}, async () => {
  const {chromium} = await import('playwright');
  const browser = await chromium.launch({headless:true});
  try {
    for (const mode of ['Household','Just me','Team']) {
      const context = await browser.newContext({viewport:{width:390,height:844}});
      await context.clock.install({time:new Date('2026-01-01T12:00:00Z')});
      const page = await context.newPage();
      const click = name => page.getByRole('button',{name,exact:true}).click();
      const nav = name => page.locator('.mobile-nav').getByRole('button',{name,exact:true}).click();
      await page.goto(process.env.BASE_URL);
      await page.getByRole('group',{name:'Budget mode'}).getByRole('button',{name:mode,exact:true}).click();
      if (mode !== 'Household') await click('+ New book');
      await page.getByRole('textbox',{name:'Book name',exact:true}).fill(`${mode} date check`);
      await page.getByRole('button',{name:/^Continue/}).click();
      await page.getByLabel('Project budget ($)',{exact:true}).fill('1000');
      await page.getByLabel('Period name',{exact:true}).fill('2026-01');
      await page.getByLabel('Start date',{exact:true}).fill('2026-01-01');
      await page.getByLabel('End date',{exact:true}).fill('2026-01-31');
      await page.getByRole('button',{name:/^Continue/}).click();
      await page.getByRole('button',{name:/Create.*book|Create.*project|Open.*board/i}).click();
      await nav('Entries');
      const date = page.getByLabel('Date',{exact:true});
      assert.equal(await date.inputValue(),'2026-01-01');
      await nav('Profile');
      await click('Edit project details');
      await page.getByLabel('Start date',{exact:true}).fill('2026-01-12');
      await click('Save budget details');
      await nav('Entries');
      assert.equal(await date.inputValue(),'2026-01-12',mode);
      await page.getByLabel('What’s it for?',{exact:true}).fill('In-period entry');
      await page.getByLabel('Spending amount',{exact:true}).fill('12');
      if (mode === 'Household' && process.env.ENTRY_DATE_SCREENSHOT) {
        await date.scrollIntoViewIfNeeded();
        await page.screenshot({path:process.env.ENTRY_DATE_SCREENSHOT});
      }
      await click('Save entry');
      await page.getByText('In-period entry saved as paid.',{exact:true}).waitFor();
      console.log(`${mode}: default 2026-01-01 → 2026-01-12; Save entry succeeded`);
      await context.close();
    }
  } finally {
    await browser.close();
  }
});
