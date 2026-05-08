const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const publicDir = path.join(__dirname, 'public', 'screenshots');

(async () => {
    console.log('Launching browser for Ambassador...');
    const browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });

    try {
        await page.goto('http://localhost:3000', { waitUntil: 'networkidle0' });

        await page.type('input[type="email"]', 'iongom@mubs.ac.ug');
        await page.type('input[type="password"]', '$panner2');
        
        await Promise.all([
            page.waitForNavigation({ waitUntil: 'networkidle0' }),
            page.click('button[type="submit"]')
        ]);
        
        await new Promise(r => setTimeout(r, 1000));
        
        console.log('Navigating to Ambassador Dashboard...');
        await page.goto('http://localhost:3000/ambassador', { waitUntil: 'networkidle0' });
        await new Promise(r => setTimeout(r, 1500));
        
        await page.screenshot({ path: path.join(publicDir, 'ambassador-dashboard.png'), fullPage: true });

        console.log('Done capturing ambassador screenshot!');

    } catch (err) {
        console.error('Error during capture:', err);
    } finally {
        await browser.close();
    }
})();
