/**
 * Sangama meeting stability test suite
 */
import { chromium } from 'playwright';

const BASE = process.env.TEST_BASE || 'http://localhost:3001';
const ROOM = `test-${Date.now()}`;
const MEETING_URL = `${BASE}/meeting/${ROOM}`;

const BAD_PATTERNS = [
    /could not createOffer with closed peer connection/,
    /publishing rejected.*engine not connected/i,
    /useSequentialRoomConnectDisconnect: room connect \/ disconnect occurring in rapid sequence/,
];

function analyzeLogs(logs) {
    const errors = logs.filter(l => {
        if (l.type !== 'error') return false;
        // Headless browsers often cannot publish real media tracks
        if (/NotSupportedError: Not supported/.test(l.text)) return false;
        return true;
    }).concat(
        logs.filter(l => BAD_PATTERNS.some(p => p.test(l.text)))
    );
    const connectCycles = logs.filter(l => /connection state changed: connecting -> connected/.test(l.text)).length;
    const disconnectCycles = logs.filter(l => /connection state changed: connected -> disconnected/.test(l.text)).length;
    const reconnectLoops = connectCycles > 2 && disconnectCycles > 1;
    return { errors, connectCycles, disconnectCycles, reconnectLoops };
}

async function joinMeeting(page, name) {
    await page.goto(MEETING_URL, { waitUntil: 'networkidle' });
    await page.locator('text=Green Room Preview').waitFor({ timeout: 15000 });
    await page.locator('input').first().fill(name);
    await page.getByRole('button', { name: /Join Meeting Room/i }).click();
    await page.locator('[data-testid="CallEndIcon"]').waitFor({ timeout: 60000 });
    await page.waitForTimeout(3000);
}

async function collectLogs(page, logs) {
    page.on('console', (msg) => {
        logs.push({ type: msg.type(), text: msg.text() });
    });
}

async function main() {
    const browser = await chromium.launch({ headless: true });
    let failed = false;

    // Test 1: Single user join stability
    {
        const context = await browser.newContext({ permissions: ['microphone', 'camera'] });
        const page = await context.newPage();
        const logs = [];
        collectLogs(page, logs);

        await joinMeeting(page, 'user-a');
        const hasCustomUI = await page.locator('[data-testid="CallEndIcon"]').count() > 0;
        const hasLobby = await page.locator('text=Green Room Preview').count() > 0;
        const analysis = analyzeLogs(logs);

        console.log('TEST 1 join stability:', {
            hasCustomUI,
            hasLobby,
            connectCycles: analysis.connectCycles,
            disconnectCycles: analysis.disconnectCycles,
            reconnectLoops: analysis.reconnectLoops,
        });

        if (!hasCustomUI || hasLobby || analysis.reconnectLoops || analysis.errors.length) {
            console.error('TEST 1 FAILED', analysis.errors.map(e => e.text));
            failed = true;
        } else {
            console.log('TEST 1 PASSED');
        }

        // Test 1b: Leave meeting
        await page.locator('button').filter({ has: page.locator('[data-testid="CallEndIcon"]') }).click();
        await page.waitForTimeout(4000);
        const left = !page.url().includes('/meeting/');
        console.log('TEST 1b leave:', left ? 'PASSED' : 'FAILED', page.url());
        if (!left) failed = true;

        await context.close();
    }

    // Test 2: Multi-user
    {
        const ctxA = await browser.newContext({ permissions: ['microphone', 'camera'] });
        const ctxB = await browser.newContext({ permissions: ['microphone', 'camera'] });
        const pageA = await ctxA.newPage();
        const pageB = await ctxB.newPage();
        const logsA = [];
        const logsB = [];
        collectLogs(pageA, logsA);
        collectLogs(pageB, logsB);

        await joinMeeting(pageA, 'alice');
        await joinMeeting(pageB, 'bob');
        await pageA.waitForTimeout(5000);

        const bodyA = await pageA.locator('body').innerText();
        const bobVisible = bodyA.includes('bob') || bodyA.includes('BO');
        const analysisA = analyzeLogs(logsA);
        const analysisB = analyzeLogs(logsB);

        console.log('TEST 2 multi-user:', {
            bobVisible,
            connectA: analysisA.connectCycles,
            connectB: analysisB.connectCycles,
            reconnectA: analysisA.reconnectLoops,
            reconnectB: analysisB.reconnectLoops,
        });

        if (analysisA.reconnectLoops || analysisB.reconnectLoops || analysisA.errors.length || analysisB.errors.length) {
            console.error('TEST 2 FAILED errors');
            failed = true;
        } else {
            console.log('TEST 2 PASSED');
        }

        // B leaves
        await pageB.locator('button').filter({ has: pageB.locator('[data-testid="CallEndIcon"]') }).click();
        await pageA.waitForTimeout(3000);
        const afterBLeave = analyzeLogs(logsA);
        if (afterBLeave.reconnectLoops) {
            console.error('TEST 2b reconnect after B left');
            failed = true;
        } else {
            console.log('TEST 2b PASSED (no reconnect loop after B left)');
        }

        await pageA.locator('button').filter({ has: pageA.locator('[data-testid="CallEndIcon"]') }).click();
        await ctxA.close();
        await ctxB.close();
    }

    // Test 3: Rejoin
    {
        const context = await browser.newContext({ permissions: ['microphone', 'camera'] });
        const page = await context.newPage();
        const logs = [];
        collectLogs(page, logs);

        await joinMeeting(page, 'rejoin-user');
        await page.locator('button').filter({ has: page.locator('[data-testid="CallEndIcon"]') }).click();
        await page.waitForTimeout(3000);
        await page.goto(MEETING_URL, { waitUntil: 'networkidle' });
        await page.locator('input').first().fill('rejoin-user');
        await page.getByRole('button', { name: /Join Meeting Room/i }).click();
        await page.locator('[data-testid="CallEndIcon"]').waitFor({ timeout: 60000 });
        await page.waitForTimeout(3000);

        const analysis = analyzeLogs(logs);
        console.log('TEST 3 rejoin:', { connectCycles: analysis.connectCycles, reconnectLoops: analysis.reconnectLoops });
        if (analysis.reconnectLoops || !(await page.locator('[data-testid="CallEndIcon"]').count())) {
            failed = true;
            console.error('TEST 3 FAILED');
        } else {
            console.log('TEST 3 PASSED');
        }
        await context.close();
    }

    await browser.close();

    if (failed) {
        console.error('\nOVERALL: FAILED');
        process.exit(1);
    }
    console.log('\nOVERALL: ALL TESTS PASSED');
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
