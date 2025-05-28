const config = {
    // Music sources with their selectors
    sources: {
        "MrTehran": {
            url: "https://mrtehran.app/browse/latest",
            selectors: {
                MusicContainer: 'div.track-line-container > .track-line',
                title: '.title a',
                artist: '.artist',
                link: '.title a',
                image: '.thumbail img',
            }
        },
    },

    // Browser settings
    browser: {
        headless: false,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-web-security',
            '--disable-features=IsolateOrigins,site-per-process',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--disable-gpu'
        ],
        ignoreHTTPSErrors: true,
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.4896.127 Safari/537.36',
        viewport: {width: 1920, height: 1080},
        headers: {
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
            'sec-ch-ua': '"Google Chrome";v="112", "Chromium";v="112", "Not=A?Brand";v="99"',
            'sec-ch-ua-mobile': '?0',
            'sec-ch-ua-platform': '"Windows"',
            'DNT': '1',
            'Upgrade-Insecure-Requests': '1',
            'Cache-Control': 'max-age=0'
        }
    },
    filters: ['خامنه‌ای', 'فلسطین', 'شهید رئیسی', 'رهبر انقلاب', 'قرآن', 'نماز', 'صهیونیستی', 'دفاع مقدس', 'ابراهیم رئیسی']
};

module.exports = {config};