const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { chromium } = require('playwright');
const XLSX = require('../node_modules/xlsx');

const round = 'HM크루 3회차';
const artifacts = fs.mkdtempSync(path.join(os.tmpdir(), 'hm-newdata-browser-'));
const baseUrl = process.env.NEWDATA_BROWSER_URL || 'http://127.0.0.1:5178';
let checks = 0;
const fixture = (id, team, season, selectedRound, nickname, amount) => ({
  id, team, season, round: selectedRound, nickname, amount,
  user_id: nickname + '-id', streamer: '공통스트리머', type: '후원', chat: '응원', time: '2026-10-01 12:00:00'
});
const records = [
  fixture(1, 'H팀', '시즌1', round, 'H후원자A', 100),
  fixture(2, 'H팀', '시즌1', round, 'H후원자A', -20),
  fixture(3, 'H팀', '시즌1', round, 'H후원자B', 50),
  fixture(4, 'H팀', '시즌1', 'HM크루 4회차', 'H후원자C', 200),
  fixture(5, 'M팀', '시즌1', round, 'M후원자', 700),
  fixture(6, 'H팀', '시즌2', round, 'H시즌2후원자', 900),
  fixture(7, null, '시즌1', round, 'NULL후원자', 999999)
];
const requests = [];
const uploads = [];
const pageErrors = [];
let failRead = false;
let partialUpload = false;
let holdRead = false;
let releaseHeld;
let heldRequested;
let heldStarted = new Promise(resolve => { heldRequested = resolve; });
const headers = ['아이디', '닉네임', '채팅', '스트리머', '종류', '개수', '시간', 'team', 'season', 'round'];
const workbook = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([
  headers,
  ['upload-id', 'Excel후원자', '응원', '공통스트리머', '후원', '1,234개', 46296.5, 'H팀', '시즌1', 'HM크루 2회차'],
  ['upload-id', 'Excel후원자', '응원', '공통스트리머', '후원', -100, 46296.5, 'H팀', '시즌1', 'HM크루 2회차']
]), 'Sheet1');
const excelPath = path.join(artifacts, 'same-excel.xlsx');
XLSX.writeFile(workbook, excelPath);
const workbookWithoutScope = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(workbookWithoutScope, XLSX.utils.aoa_to_sheet([
  headers.slice(0, 7), ['plain-id', 'Excel후원자', '응원', '공통스트리머', '후원', 25, '2026-10-01 12:00:00']
]), 'Sheet1');
const plainExcelPath = path.join(artifacts, 'plain-excel.xlsx');
XLSX.writeFile(workbookWithoutScope, plainExcelPath);

async function check(name, action) {
  await action();
  checks++;
  console.log('PASS ' + name);
}

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.NEWDATA_CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    page.on('pageerror', error => pageErrors.push(error.message));
    await page.route('**/newdata/**', async route => {
      const req = route.request();
      const url = new URL(req.url());
      if (req.method() === 'GET') {
        const params = Object.fromEntries(url.searchParams);
        requests.push(params);
        if (holdRead && params.team === 'H팀' && params.season === '시즌1') {
          heldRequested();
          await new Promise(resolve => { releaseHeld = resolve; });
        }
        if (failRead) {
          await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: 'test read failure' }) });
          return;
        }
        const data = records.filter(row => row.team === params.team && row.season === params.season && (!params.round || row.round === params.round));
        // 구분되지 않은 서버 응답에도 프론트가 NULL/다른 팀을 섞지 않는지 확인한다.
        const mixed = [...data, records.find(row => row.team === null)];
        try { await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ success: true, count: mixed.length, data: mixed }) }); } catch {}
      } else {
        const body = req.postDataJSON();
        uploads.push(body);
        const data = body.data.map((row, i) => ({
          id: 1000 + uploads.length * 10 + i, nickname: row.닉네임, user_id: row.아이디,
          streamer: row.스트리머, amount: row.개수, time: row.시간, chat: row.채팅,
          type: row.종류, team: body.team, season: body.season, round: body.round
        }));
        if (partialUpload) {
          await route.fulfill({ status: 207, contentType: 'application/json', body: JSON.stringify({
            success: false, requestedRows: data.length, insertedRows: 1, failedRows: data.length - 1,
            failedBatches: [{ batchNumber: 1, count: 1, message: 'test partial failure' }], data: data.slice(0, 1)
          }) });
        } else {
          records.push(...data);
          await route.fulfill({ contentType: 'application/json', body: JSON.stringify({
            success: true, requestedRows: data.length, insertedRows: data.length, failedRows: 0, data
          }) });
        }
      }
    });

    await check('1 첫 화면: 기존 로고/H팀/M팀만 표시, 데이터 요청 없음', async () => {
      await page.goto(baseUrl + '/');
      await page.getByRole('button', { name: 'H팀', exact: true }).waitFor();
      assert.equal(await page.getByRole('button', { name: 'M팀', exact: true }).count(), 1);
      assert.equal(await page.locator('select, table').count(), 0);
      assert.ok(await page.locator('.hero-logo').evaluate(img => img.complete && img.naturalWidth > 0));
      assert.equal(requests.length, 0);
      await page.screenshot({ path: path.join(artifacts, 'mobile-landing.png'), fullPage: true });
    });
    await check('2 H팀 선택: 시즌1/2/3 표시, 회차/데이터 요청 없음', async () => {
      await page.getByRole('button', { name: 'H팀', exact: true }).click();
      for (const season of ['시즌1', '시즌2', '시즌3']) assert.equal(await page.getByRole('button', { name: season, exact: true }).count(), 1);
      assert.equal(await page.locator('select, table').count(), 0);
      assert.equal(requests.length, 0);
    });
    await check('3 H팀/시즌1/3회차: 세 query parameter, 기존 점수/순위/기여도/누적 보존', async () => {
      await page.getByRole('button', { name: '시즌1', exact: true }).click();
      await page.getByLabel('회차').locator('option', { hasText: round }).waitFor({ state: 'attached' });
      assert.equal(await page.getByLabel('회차').inputValue(), '');
      await page.getByLabel('회차').selectOption(round);
      await page.getByLabel('스트리머').locator('option', { hasText: '공통스트리머' }).waitFor({ state: 'attached' });
      await page.getByLabel('스트리머').selectOption('공통스트리머');
      await page.locator('.selected-banner').waitFor();
      assert.match(await page.locator('.selected-banner').innerText(), /점수 130점/);
      assert.match(await page.locator('.selected-banner').innerText(), /기여도 170점/);
      const donorRows = await page.locator('.donor-table tbody tr').allTextContents();
      assert.match(donorRows[0], /H후원자A/);
      assert.match(donorRows[0], /80점/);
      assert.match(donorRows[0], /120점/);
      assert.match(donorRows[1], /H후원자B/);
      const cumulative = page.locator('section').filter({ has: page.getByRole('heading', { name: '전체 회차 누적', exact: true }) }).last();
      assert.match(await cumulative.innerText(), /330점/);
      assert.match(await cumulative.innerText(), /370점/);
      assert.ok(requests.some(req => req.team === 'H팀' && req.season === '시즌1' && req.round === round));
      assert.doesNotMatch(await page.locator('.donor-table').innerText(), /NULL후원자|M후원자/);
      await page.screenshot({ path: path.join(artifacts, 'mobile-data.png'), fullPage: true });
      for (const width of [320, 1280, 390]) {
        await page.setViewportSize({ width, height: 844 });
        await page.waitForFunction(() => document.documentElement.scrollWidth <= window.innerWidth, null, { timeout: 3000 });
      }
    });
    await check('4 M팀/시즌1/같은 회차: 팀 변경 시 시즌/회차 초기화, H 데이터 없음', async () => {
      await page.getByRole('button', { name: '← 팀 선택' }).click();
      await page.getByRole('button', { name: 'M팀', exact: true }).click();
      assert.equal(await page.locator('select, table').count(), 0);
      await page.getByRole('button', { name: '시즌1', exact: true }).click();
      await page.getByLabel('회차').locator('option', { hasText: round }).waitFor({ state: 'attached' });
      assert.equal(await page.getByLabel('회차').inputValue(), '');
      await page.getByLabel('회차').selectOption(round);
      await page.getByLabel('스트리머').locator('option', { hasText: '공통스트리머' }).waitFor({ state: 'attached' });
      await page.getByLabel('스트리머').selectOption('공통스트리머');
      await page.locator('.donor-table').waitFor();
      assert.match(await page.locator('.donor-table').innerText(), /M후원자/);
      assert.doesNotMatch(await page.locator('.donor-table').innerText(), /H후원자|NULL후원자/);
    });
    await check('5 H팀 시즌 변경: 회차/스트리머/검색 초기화, 시즌2 데이터 분리', async () => {
      await page.getByRole('button', { name: '← 팀 선택' }).click();
      await page.getByRole('button', { name: 'H팀', exact: true }).click();
      await page.getByRole('button', { name: '시즌1', exact: true }).click();
      await page.getByLabel('회차').locator('option', { hasText: round }).waitFor({ state: 'attached' });
      await page.getByLabel('회차').selectOption(round);
      await page.getByLabel('스트리머').locator('option', { hasText: '공통스트리머' }).waitFor({ state: 'attached' });
      await page.getByLabel('스트리머').selectOption('공통스트리머');
      await page.locator('.donor-table').waitFor();
      await page.locator('.search-box input').fill('H후원자A');
      await page.getByRole('button', { name: '시즌2', exact: true }).click();
      await page.getByLabel('회차').locator('option', { hasText: round }).waitFor({ state: 'attached' });
      assert.equal(await page.getByLabel('회차').inputValue(), '');
      assert.equal(await page.getByLabel('스트리머').inputValue(), '');
      assert.equal(await page.locator('.donor-table').count(), 0);
      await page.getByLabel('회차').selectOption(round);
      await page.getByLabel('스트리머').locator('option', { hasText: '공통스트리머' }).waitFor({ state: 'attached' });
      await page.getByLabel('스트리머').selectOption('공통스트리머');
      await page.locator('.donor-table').waitFor();
      assert.equal(await page.locator('.search-box input').inputValue(), '');
      assert.match(await page.locator('.donor-table').innerText(), /H시즌2후원자/);
      assert.doesNotMatch(await page.locator('.donor-table').innerText(), /H후원자A|M후원자/);
    });
    await check('8 팀 미선택: 시즌/회차/Excel 비활성화, 업로드 없음', async () => {
      await page.goto(baseUrl + '/admin');
      await page.getByLabel('팀').waitFor();
      assert.equal(await page.getByLabel('시즌').isDisabled(), true);
      assert.equal(await page.getByLabel('회차').isDisabled(), true);
      assert.equal(await page.locator('#excel-upload').isDisabled(), true);
      assert.equal(await page.locator('.admin-actions').count(), 0);
      assert.equal(uploads.length, 0);
    });
    await check('9 시즌 미선택: 회차/Excel 비활성화', async () => {
      await page.getByLabel('팀').selectOption('H팀');
      assert.equal(await page.getByLabel('회차').isDisabled(), true);
      assert.equal(await page.locator('#excel-upload').isDisabled(), true);
    });
    await check('10 회차 미선택: Excel 비활성화', async () => {
      await page.getByLabel('시즌').selectOption('시즌1');
      assert.equal(await page.locator('#excel-upload').isDisabled(), true);
      await page.getByLabel('회차').selectOption(round);
      assert.equal(await page.locator('#excel-upload').isDisabled(), false);
    });
    await check('6 H팀/시즌1/3회차/Excel A: 실제 파싱/metadata/숫자/시간 변환 확인', async () => {
      await page.locator('#excel-upload').setInputFiles(excelPath);
      await page.getByRole('button', { name: '2건 업로드', exact: true }).waitFor();
      await page.getByRole('button', { name: '2건 업로드', exact: true }).click();
      await page.locator('.admin-status.success').waitFor();
      assert.match(await page.locator('.admin-status.success').innerText(), /H팀 \/ 시즌1 \/ HM크루 3회차/);
      const request = uploads.at(-1);
      assert.deepEqual([request.team, request.season, request.round], ['H팀', '시즌1', round]);
      assert.equal(request.data[0].개수, 1234);
      assert.equal(request.data[1].개수, -100);
      assert.match(request.data[0].시간, /^\d{4}-\d{2}-\d{2} 12:00:00$/);
      assert.ok(request.data.every(row => !Object.hasOwn(row, '_row') && row.회차 === round));
    });
    await check('7 M팀/시즌2/같은 회차/같은 Excel: UI 값이 Excel 값보다 우선', async () => {
      await page.getByLabel('팀').selectOption('M팀');
      assert.equal(await page.getByLabel('시즌').inputValue(), '');
      assert.equal(await page.getByLabel('회차').inputValue(), '');
      assert.equal(await page.locator('.admin-preview-table').count(), 0);
      await page.getByLabel('시즌').selectOption('시즌2');
      await page.getByLabel('회차').selectOption(round);
      await page.locator('#excel-upload').setInputFiles(excelPath);
      await page.getByRole('button', { name: '2건 업로드', exact: true }).click();
      await page.locator('.admin-status.success').waitFor();
      const request = uploads.at(-1);
      assert.deepEqual([request.team, request.season, request.round], ['M팀', '시즌2', round]);
      assert.ok(request.data.every(row => row.team === 'M팀' && row.season === '시즌2' && row.회차 === round));
      await page.screenshot({ path: path.join(artifacts, 'mobile-admin.png'), fullPage: true });
    });
    await check('추가: scope 컬럼 없는 Excel도 정상 업로드', async () => {
      await page.getByRole('button', { name: '다시 선택', exact: true }).click();
      await page.locator('#excel-upload').setInputFiles(plainExcelPath);
      await page.getByRole('button', { name: '1건 업로드', exact: true }).click();
      await page.locator('.admin-status.success').waitFor();
      assert.equal(uploads.at(-1).data[0].개수, 25);
    });
    await check('추가: 일부 성공(207)은 실패 건수/배치 오류를 표시', async () => {
      partialUpload = true;
      await page.getByRole('button', { name: '다시 선택', exact: true }).click();
      await page.locator('#excel-upload').setInputFiles(excelPath);
      await page.getByRole('button', { name: '2건 업로드', exact: true }).click();
      await page.locator('.admin-status.error').waitFor();
      assert.match(await page.locator('.admin-status.error').innerText(), /성공 1건 \/ 실패 1건/);
      assert.match(await page.locator('body').innerText(), /test partial failure/);
      partialUpload = false;
    });
    await check('추가: 조회 후 새로고침이 회차/스트리머 선택을 유지', async () => {
      await page.goto(baseUrl + '/');
      await page.getByRole('button', { name: 'M팀', exact: true }).click();
      await page.getByRole('button', { name: '시즌2', exact: true }).click();
      await page.getByLabel('회차').locator('option', { hasText: round }).waitFor({ state: 'attached' });
      await page.getByLabel('회차').selectOption(round);
      await page.getByLabel('스트리머').locator('option', { hasText: '공통스트리머' }).waitFor({ state: 'attached' });
      await page.getByLabel('스트리머').selectOption('공통스트리머');
      await page.locator('.donor-table').waitFor();
      await page.getByRole('button', { name: '새로고침', exact: true }).click();
      await page.locator('.donor-table').waitFor();
      assert.equal(await page.getByLabel('회차').inputValue(), round);
      assert.equal(await page.getByLabel('스트리머').inputValue(), '공통스트리머');
    });
    await check('추가: 데이터 없음과 API 오류 메시지 표시', async () => {
      await page.getByRole('button', { name: '시즌3', exact: true }).click();
      await page.getByText('해당 팀 / 시즌 / 회차에 데이터가 없습니다.', { exact: true }).waitFor();
      failRead = true;
      await page.getByRole('button', { name: '새로고침', exact: true }).click();
      await page.getByText('데이터를 불러오지 못했습니다.', { exact: true }).waitFor();
      assert.equal(await page.locator('table').count(), 0);
      failRead = false;
    });
    await check('추가: 늦은 이전 응답이 팀 변경 후 화면을 덮어쓰지 않음', async () => {
      await page.getByRole('button', { name: '← 팀 선택' }).click();
      await page.getByRole('button', { name: 'H팀', exact: true }).click();
      holdRead = true;
      await page.getByRole('button', { name: '시즌1', exact: true }).click();
      await heldStarted;
      await page.getByText('데이터를 불러오는 중입니다.', { exact: true }).waitFor();
      await page.getByRole('button', { name: '← 팀 선택' }).click();
      await page.getByRole('button', { name: 'M팀', exact: true }).click();
      holdRead = false;
      releaseHeld();
      await page.getByRole('button', { name: '시즌1', exact: true }).click();
      await page.getByLabel('회차').locator('option', { hasText: round }).waitFor({ state: 'attached' });
      const options = await page.getByLabel('회차').locator('option').allTextContents();
      assert.ok(!options.includes('HM크루 4회차'));
      assert.equal(await page.getByLabel('회차').inputValue(), '');
    });
    await check('추가: 320px/390px/1280px 화면에서 가로 넘침 없고 버튼 높이 48px 이상', async () => {
      await page.goto(baseUrl + '/');
      for (const width of [320, 390, 1280]) {
        await page.setViewportSize({ width, height: 900 });
        await page.getByRole('button', { name: 'H팀', exact: true }).waitFor();
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
        assert.ok((await page.getByRole('button', { name: 'H팀', exact: true }).boundingBox()).height >= 48);
      }
      await page.screenshot({ path: path.join(artifacts, 'desktop-landing.png'), fullPage: true });
    });
    assert.deepEqual(pageErrors, []);
    console.log(JSON.stringify({ checks, queryRequests: requests.length, uploadRequests: uploads.length, pageErrors, artifacts }));
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
