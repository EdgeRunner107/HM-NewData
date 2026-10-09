const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { chromium } = require('playwright');

const baseUrl = process.env.NEWDATA_BROWSER_URL || 'http://127.0.0.1:5178';
const artifacts = fs.mkdtempSync(path.join(os.tmpdir(), 'hm-top200-browser-'));
const round = 'HM크루 3회차';
const streamer = '공통스트리머';
const scopes = ['H팀', 'M팀'].flatMap(team => ['시즌1', '시즌2', '시즌3'].map(season => ({ team, season })));
const records = scopes.flatMap((scope, index) => [
  { ...scope, id: index * 10 + 1, round, streamer, nickname: '기존후원자', user_id: 'old', amount: 100,
    time: '2026-10-01 12:00:00', type: '후원' },
  { ...scope, id: index * 10 + 2, round, streamer, nickname: '기존후원자', user_id: 'old', amount: -20,
    time: '2026-10-01 12:01:00', type: '후원' },
  { ...scope, id: index * 10 + 3, round: 'HM크루 4회차', streamer, nickname: '다른회차후원자',
    user_id: 'other-round', amount: 300, time: '2026-10-01 13:00:00', type: '후원' }
]);
const viewRows = scopes.flatMap(scope => [
  { ...scope, rank: 1, nickname: `${scope.team}${scope.season}전체회차후원자`, total_amount: '15300000', donation_count: '152' },
  { ...scope, rank: 3, nickname: `${scope.team}${scope.season}두번째후원자`, total_amount: '12500000', donation_count: '88' }
]);
const requests = [];
const pageErrors = [];
let mode = 'success';
let heldStarted;
let releaseHeld;
let responseFinished;
let checks = 0;

async function check(name, action) {
  await action();
  checks++;
  console.log('PASS ' + name);
}

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.NEWDATA_CHROME_PATH ||
    'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    page.on('pageerror', error => pageErrors.push(error.message));
    await page.route('**/newdata/**', async route => {
      const url = new URL(route.request().url());
      const params = Object.fromEntries(url.searchParams);
      requests.push({ path: url.pathname, params });
      assert.equal(route.request().method(), 'GET');
      if (url.pathname.endsWith('/top200')) {
        const requestMode = mode;
        if (requestMode === 'held') {
          heldStarted();
          await new Promise(resolve => { releaseHeld = resolve; });
        }
        let response;
        if (requestMode === 'error') {
          response = { status: 500, body: { success: false, error: 'test error' } };
        } else if (requestMode === 'invalid') {
          response = { status: 200, body: { success: false, data: [] } };
        } else {
          const scoped = requestMode === 'empty' ? [] : requestMode === 'large' ?
            Array.from({ length: 205 }, (_, i) => ({ ...params, rank: i + 1,
              nickname: i === 0 ? '매우긴후원자닉네임'.repeat(12) : `후원자${i + 1}`,
              total_amount: '15300000', donation_count: '152' })) :
            viewRows.filter(row => row.team === params.team && row.season === params.season);
          // 다른 팀/시즌과 NULL 행이 와도 화면에 혼합하지 않는다.
          const data = [...scoped, ...viewRows.filter(row => row.team !== params.team || row.season !== params.season),
            { team: null, season: params.season, rank: 1, nickname: 'NULL후원자' }];
          response = { status: 200, body: { success: true, data, count: data.length } };
        }
        try {
          await route.fulfill({ status: response.status, contentType: 'application/json', body: JSON.stringify(response.body) });
        } catch {
          // 팀/시즌 변경 또는 복귀 시 취소된 요청이다.
        } finally {
          if (requestMode === 'held') responseFinished();
        }
      } else {
        assert.ok(url.pathname.endsWith('/supabase-datab'));
        const data = records.filter(row => row.team === params.team && row.season === params.season &&
          (!params.round || row.round === params.round));
        await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ success: true, count: data.length, data }) });
      }
    });

    const openButton = () => page.getByRole('button', { name: '시즌 후원자 TOP 200 보기', exact: true });
    const backButton = () => page.getByRole('button', { name: '← 기존 데이터로 돌아가기', exact: true });
    const chooseScope = async ({ team, season }) => {
      await page.goto(baseUrl);
      await page.getByRole('button', { name: team, exact: true }).click();
      await page.getByRole('button', { name: season, exact: true }).click();
      await page.getByLabel('회차').locator('option', { hasText: round }).waitFor({ state: 'attached' });
    };
    const chooseRound = async () => {
      await page.getByLabel('회차').selectOption(round);
      await page.getByLabel('스트리머').locator('option', { hasText: streamer }).waitFor({ state: 'attached' });
      await page.getByLabel('스트리머').selectOption(streamer);
      await page.locator('.donor-table').waitFor();
    };
    const holdNext = () => {
      mode = 'held';
      const started = new Promise(resolve => { heldStarted = resolve; });
      const finished = new Promise(resolve => { responseFinished = resolve; });
      return { started, finished };
    };

    await check('팀/시즌 선택 전 버튼과 TOP 200 요청 없음', async () => {
      await page.goto(baseUrl);
      await page.getByRole('button', { name: 'H팀', exact: true }).waitFor();
      assert.equal(await openButton().count(), 0);
      await page.getByRole('button', { name: 'H팀', exact: true }).click();
      assert.equal(await openButton().count(), 0);
      assert.equal(requests.length, 0);
      await page.getByRole('button', { name: '시즌1', exact: true }).click();
      await openButton().waitFor();
      assert.equal(requests.filter(req => req.path.endsWith('/top200')).length, 0);
      const sections = await page.locator('.mobile > section').all();
      assert.equal(await sections.at(-1).getAttribute('class'), 'top200-section');
    });

    for (const scope of scopes) {
      await check(`${scope.team} ${scope.season}: 기존 조회/TOP 200/복귀, 상태와 계산 보존`, async () => {
        await chooseScope(scope);
        await chooseRound();
        await page.locator('.search-box input').fill('기존후원자');
        const banner = await page.locator('.selected-banner').innerText();
        const donorTable = await page.locator('.donor-table').innerText();
        assert.match(banner, /점수 80점/);
        assert.match(banner, /기여도 120점/);
        assert.match(donorTable, /80점/);
        assert.match(donorTable, /120점/);
        await page.locator('.donor-table').evaluate(table => { table.dataset.preserved = 'yes'; });
        const before = requests.length;
        await openButton().click();
        await page.locator('.top200-table').waitFor();
        assert.deepEqual(requests.slice(before), [{ path: '/newdata/top200', params: scope }]);
        assert.equal(await page.locator('.top200-scope').innerText(), `${scope.team} · ${scope.season}`);
        const topRows = await page.locator('.top200-table tbody tr').allTextContents();
        assert.equal(topRows.length, 2);
        assert.match(topRows[0], new RegExp(`${scope.team}${scope.season}전체회차후원자`));
        assert.match(topRows[0], /1위/);
        assert.match(topRows[0], /15,300,000/);
        assert.match(topRows[0], /152회/);
        assert.match(topRows[1], /3위/);
        assert.doesNotMatch(topRows.join(''), /NULL후원자/);
        assert.equal(await page.getByLabel('회차').inputValue(), round);
        await backButton().click();
        await openButton().waitFor();
        assert.equal(await page.locator('.top200-panel').count(), 0);
        assert.equal(await page.getByLabel('회차').inputValue(), round);
        assert.equal(await page.getByLabel('스트리머').inputValue(), streamer);
        assert.equal(await page.locator('.search-box input').inputValue(), '기존후원자');
        assert.equal(await page.locator('.donor-table').getAttribute('data-preserved'), 'yes');
        assert.equal(await page.locator('.donor-table').innerText(), donorTable);
        assert.equal(await page.locator('.selected-banner').innerText(), banner);
        assert.equal(requests.length, before + 1);
      });
    }

    await check('회차 미선택 상태에서도 TOP 200 조회 가능', async () => {
      await chooseScope({ team: 'M팀', season: '시즌1' });
      assert.equal(await page.getByLabel('회차').inputValue(), '');
      const before = requests.length;
      await openButton().click();
      await page.locator('.top200-table').waitFor();
      assert.deepEqual(requests.slice(before), [{ path: '/newdata/top200', params: { team: 'M팀', season: '시즌1' } }]);
      await backButton().click();
      assert.equal(await page.getByLabel('회차').inputValue(), '');
    });

    await check('독립 loading과 요청 중 복귀/취소, 늦은 응답 차단', async () => {
      await chooseScope({ team: 'H팀', season: '시즌1' });
      await chooseRound();
      const held = holdNext();
      await openButton().click();
      await held.started;
      await page.getByText('TOP 200 데이터를 불러오는 중입니다.', { exact: true }).waitFor();
      assert.equal(await page.getByRole('button', { name: '새로고침', exact: true }).isDisabled(), false);
      assert.equal(await page.getByLabel('회차').isDisabled(), false);
      await backButton().click();
      mode = 'success';
      releaseHeld();
      await held.finished;
      assert.equal(await page.locator('.top200-panel').count(), 0);
      assert.equal(await page.getByLabel('회차').inputValue(), round);
      await openButton().click();
      await page.locator('.top200-table').waitFor();
    });

    await check('시즌/팀 변경 시 화면 초기화 및 진행 중 이전 TOP 200 응답 차단', async () => {
      await backButton().click();
      const held = holdNext();
      await openButton().click();
      await held.started;
      await page.getByRole('button', { name: '시즌2', exact: true }).click();
      await openButton().waitFor();
      assert.equal(await page.locator('.top200-panel').count(), 0);
      mode = 'success';
      await openButton().click();
      await page.locator('.top200-table').waitFor();
      releaseHeld();
      await held.finished;
      assert.equal(await page.locator('.top200-scope').innerText(), 'H팀 · 시즌2');
      assert.doesNotMatch(await page.locator('.top200-table').innerText(), /H팀시즌1/);
      await page.getByRole('button', { name: '← 팀 선택', exact: true }).click();
      assert.equal(await page.locator('.top200-section').count(), 0);
      await page.getByRole('button', { name: 'M팀', exact: true }).click();
      await page.getByRole('button', { name: '시즌2', exact: true }).click();
      await openButton().waitFor();
      assert.equal(await page.locator('.top200-panel').count(), 0);
      await openButton().click();
      await page.locator('.top200-table').waitFor();
      assert.equal(await page.locator('.top200-scope').innerText(), 'M팀 · 시즌2');
    });

    for (const failureMode of ['empty', 'error', 'invalid']) {
      await check(`${failureMode}: 전용 메시지 표시, 기존 데이터 유지/복귀`, async () => {
        mode = failureMode;
        await chooseScope({ team: 'M팀', season: '시즌1' });
        await chooseRound();
        const before = requests.length;
        const donorTable = await page.locator('.donor-table').innerText();
        await openButton().click();
        await page.getByText(failureMode === 'empty' ? '해당 팀 / 시즌의 후원자 데이터가 없습니다.' :
          'TOP 200 데이터를 불러오지 못했습니다.', { exact: true }).waitFor();
        assert.equal(await page.locator('.donor-table').innerText(), donorTable);
        assert.equal(requests.length, before + 1);
        if (failureMode === 'error') {
          mode = 'success';
          await page.getByRole('button', { name: '다시 시도', exact: true }).click();
          await page.locator('.top200-table').waitFor();
          assert.equal(requests.length, before + 2);
        }
        await backButton().click();
        assert.equal(await page.getByLabel('회차').inputValue(), round);
        assert.equal(await page.locator('.donor-table').innerText(), donorTable);
      });
    }

    await check('200명 제한과 320/390/1280px 반응형, 긴 닉네임/금액/횟수 표시', async () => {
      mode = 'large';
      await chooseScope({ team: 'H팀', season: '시즌2' });
      await openButton().click();
      await page.locator('.top200-table').waitFor();
      assert.equal(await page.locator('.top200-table tbody tr').count(), 200);
      assert.match(await page.locator('.top200-table tbody tr').last().innerText(), /200위/);
      for (const width of [320, 390, 1280]) {
        await page.setViewportSize({ width, height: 844 });
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
        const wrap = page.locator('.top200-table-wrap');
        assert.equal(await wrap.evaluate(el => getComputedStyle(el).overflowX), 'auto');
        if (width === 1280) assert.ok(await wrap.evaluate(el => el.scrollWidth <= el.clientWidth));
        await wrap.evaluate(el => { el.scrollLeft = el.scrollWidth; });
        assert.match(await page.locator('.top200-table tbody tr').first().innerText(), /15,300,000/);
        assert.match(await page.locator('.top200-table tbody tr').first().innerText(), /152회/);
        await page.locator('.top200-panel').screenshot({ path: path.join(artifacts, `top200-${width}.png`) });
      }
      await backButton().click();
    });
    assert.deepEqual(pageErrors, []);
    console.log(JSON.stringify({ checks, requests: requests.length, pageErrors, artifacts }));
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
