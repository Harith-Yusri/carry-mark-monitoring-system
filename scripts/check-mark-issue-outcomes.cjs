// Intercepted backend only: exercise the actual compiled lecturer UI safely.
const { start, chromium } = require('./check-staff-loading.cjs');
const assert = require('node:assert/strict');
(async () => {
  const browser = await chromium.launch({ headless: true, ...(process.env.CAMS_BROWSER_EXECUTABLE ? { executablePath: process.env.CAMS_BROWSER_EXECUTABLE } : {}) });
  try {
    for (const outcome of ['reject', 'correct']) {
      const { context, page, control, errors } = await start(browser, 'lecturer', 'data', outcome === 'correct', false);
      control.issue.corrections = []; control.issue.status = 'submitted';
      page.on('dialog', dialog => dialog.accept());
      await page.getByRole('button', { name: /Manage Subject Hub/ }).first().click();
      await page.getByRole('button', { name: /Mark Issues/ }).click();
      await page.getByText('Please review fixture', { exact: true }).waitFor();
      for (const label of ['Mark as Reviewing', 'Resolve', 'Request Mark Correction', 'Save Correction', 'Release Updated Mark']) assert.equal(await page.getByRole('button', { name: label, exact: true }).count(), 0);
      assert.equal(await page.getByRole('button', { name: 'Reject', exact: true }).isDisabled(), true);
      await page.getByLabel('Response / correction reason (required)', { exact: true }).fill(outcome === 'reject' ? 'Checked the script; existing score is correct.' : 'Verified entry error against the script.');
      if (outcome === 'reject') {
        await page.getByRole('button', { name: 'Reject', exact: true }).click();
        await page.getByText('Rejected', { exact: true }).waitFor();
        assert.equal(control.issue.current_score, 50);
        assert.deepEqual(control.calls.filter(name => name === 'respond_to_mark_issue'), ['respond_to_mark_issue']);
      } else {
        const score = page.getByRole('spinbutton', { name: 'Corrected mark for FIXTURE1 Fixture Quiz', exact: true });
        for (const value of ['101', '-1', '80.001', '50']) {
          await score.fill(value);
          assert.equal(await page.getByRole('button', { name: 'Correct Mark', exact: true }).isDisabled(), true);
        }
        await score.fill('80');
        await page.getByRole('button', { name: 'Correct Mark', exact: true }).click();
        await page.getByRole('button', { name: 'Release Updated Mark', exact: true }).waitFor();
        assert.equal(control.issue.current_score, 50);
        await page.getByText('Corrected mark: 80 / 100 · private until released', { exact: true }).waitFor();
        assert.equal(control.calls.includes('release_corrected_mark'), false);
        await page.getByRole('button', { name: 'Release Updated Mark', exact: true }).click();
        await page.getByText('Corrected', { exact: true }).first().waitFor();
        await page.getByText('Current Released mark: 80 / 100', { exact: true }).waitFor();
        assert.equal(await page.getByRole('button', { name: 'Release Updated Mark', exact: true }).count(), 0);
        assert.equal(control.calls.filter(name => name === 'release_corrected_mark').length, 1);
      }
      assert.equal(control.calls.some(name => ['request_mark_correction', 'review_mark_correction', 'update_approved_mark'].includes(name)), false);
      assert.deepEqual(errors, []);
      console.log(`${outcome}: passed`);
      await context.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
