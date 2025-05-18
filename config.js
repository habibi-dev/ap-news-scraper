const config = {
    // News sources with their selectors
    sources: {
        "MehrNews": {
            url: "https://www.mehrnews.com/archive",
            selectors: {
                newsContainer: 'li.news',
                title: 'h3 a',
                link: 'h3 a',
                text: 'article .item-body',
                remove: 'article .item-header',
                image: 'head > meta[property="og:image"]',
                video: "video.jw-video.jw-reset"
            }
        },
        "IranIntl": {
            url: "https://www.iranintl.com/en/iran-insights",
            selectors: {
                newsContainer: 'article',
                title: 'h3',
                link: 'header > a',
                text: 'article main > section',
                remove: 'figure',
                image: 'head > meta[property="og:image"]',
                video: "video.jw-video.jw-reset"
            }
        },
        "Apnews": {
            url: "https://apnews.com/world-news",
            selectors: {
                newsContainer: '.PagePromo',
                title: 'h3 span.PagePromoContentIcons-text',
                link: 'h3.PagePromo-title > a',
                text: '.RichTextStoryBody.RichTextBody,.VideoPage-pageSubHeading',
                remove: '.RichTextStoryBody.RichTextBody > div',
                image: 'head > meta[property="og:image"]',
                video: "video.jw-video.jw-reset"
            }
        },
        "NDTV": {
            url: "https://www.ndtv.com/world",
            selectors: {
                newsContainer: '.crd-b.crd-b_h-at.res_crd-1,li.ls-ns_li,li.crd-d_v1-li',
                title: '.crd_lnk a,h1.crd_ttl7 a',
                link: '.crd_lnk a,h1.crd_ttl7 a',
                text: '.Art-exp_cn',
                remove: 'div#ndpl-iframe,iframe',
                image: 'head > meta[property="og:image"]',
                video: ""
            }
        },
        "CNN": {
            url: "https://edition.cnn.com/world",
            selectors: {
                newsContainer: 'a.container__link.container__link--type-article.container_lead-plus-headlines__link',
                title: 'span.container__headline-text',
                link: '',
                text: '.article__content,.video-resource__description',
                remove: '.container.container_list-headlines-ranked,.container.container_list-headlines-with-read-times',
                image: 'head > meta[property="og:image"]',
                video: "video#bitmovinplayer-video-top-player-container-1"
            }
        },
        "BBC": {
            url: "https://www.bbc.com/news",
            selectors: {
                newsContainer: '[data-testid="anchor-inner-wrapper"]',
                title: 'h2',
                link: 'a',
                text: 'main#main-content > article',
                remove: 'article [data-component="headline-block"], article [data-component="byline-block"],article [data-component="video-block"],article [data-testid="ad-unit"],article [data-component="links-block"],article figure',
                image: 'head > meta[property="og:image"]',
                video: ""
            }
        },
        "Time": {
            url: "https://time.com/section/world/",
            selectors: {
                newsContainer: 'a',
                title: 'h2.headline',
                link: '',
                text: 'article#article-body',
                remove: 'section[aria-labelledby="intro-section"],article#article-body > div > div',
                image: 'head > meta[property="og:image"]',
                video: ""
            }
        },
        "WashingtonPost": {
            url: "https://www.washingtonpost.com/world/",
            selectors: {
                newsContainer: '.story-headline',
                title: 'h3',
                link: 'a',
                text: '.grid-body .teaser-content',
                remove: '.grid-body>div[data-testid="byline-container"],.grid-body [data-testid="subscribe-promo-button"]',
                image: 'head > meta[property="og:image"]',
                video: ""
            }
        },
        "NBCNews": {
            url: "https://www.nbcnews.com/world",
            selectors: {
                newsContainer: '.headline-standard,li h2',
                title: 'h2,a',
                link: 'h2 a,a',
                text: '.article-body',
                remove: '.article-body > section , .article-body figure,.article-body .recommended-intersection-ref,.article-body section.inline-video.inline-video--in-body',
                image: 'head > meta[property="og:image"]',
                video: ""
            }
        }
    },

    // Browser settings
    browser: {
        headless: true,
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