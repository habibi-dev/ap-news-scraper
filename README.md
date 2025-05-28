# Music Scraper, Translator and Publisher

این پروژه یک سیستم کامل برای خراش داده‌های خبری، ترجمه و انتشار اخبار در کانال تلگرام است.

## ویژگی‌ها

- خراش داده‌های خبری از منابع متعدد خبری جهانی
- ذخیره‌سازی اخبار در پایگاه داده SQLite
- بررسی و فیلتر کردن اخبار با استفاده از Gemini AI
- استخراج محتوای کامل خبر و تصاویر
- ترجمه اخبار با استفاده از Gemini AI
- انتشار اخبار ترجمه شده در کانال تلگرام
- مدیریت وضعیت‌های مختلف خبر (در انتظار بررسی، در انتظار ترجمه، ترجمه شده، منتشر شده)

## پیش‌نیازها

- Node.js (نسخه 14 یا بالاتر)
- کلید API جمنای
- توکن ربات تلگرام

## نصب

1. کلون کردن مخزن
```bash
git clone https://github.com/habibi-dev/ap-Music-scraper.git
cd ap-Music-scraper
```

2. نصب وابستگی‌ها
```bash
npm install
```

3. تنظیم پیکربندی در فایل `config.js`
    - وارد کردن کلید API جمنای
    - وارد کردن توکن ربات تلگرام و شناسه کانال
    - تنظیم پرامپت‌های ترجمه و بررسی

## نحوه استفاده

### خراش داده‌های خبری
```bash
npm run read
# یا برای منبع خاص
node index.js scrape bbc
```

### پردازش اخبار در انتظار بررسی
```bash
npm run pending
```

### ترجمه اخبار
```bash
npm run translate
```

### انتشار اخبار ترجمه شده
```bash
npm run publish
```

## ساختار پروژه

```
/project
├── index.js                  # فایل اصلی برای اجرای برنامه
├── config.js                 # تنظیمات برنامه
├── package.json              # وابستگی‌های پروژه
├── /services
│   ├── scraper.js            # سرویس خراش‌گر وب
│   ├── MusicService.js        # سرویس مدیریت خبر
│   ├── telegram.js           # سرویس ارسال به تلگرام
├── /db
│   ├── MusicDatabase.js       # عملیات پایگاه داده
├── /utils
│   ├── helpers.js            # توابع کمکی مثل delay
├── /api
│   ├── geminiApi.js          # ارتباط با API جمنای
```

## فرایند کلی

1. **خراش داده**: اخبار از منابع مختلف جمع‌آوری و در پایگاه داده ذخیره می‌شوند.
2. **بررسی**: عناوین خبری به جمنای ارسال می‌شوند تا مناسب بودن آنها برای ترجمه بررسی شود.
3. **استخراج محتوا**: محتوای کامل خبرهای تأیید شده استخراج می‌شود.
4. **ترجمه**: محتوای کامل خبر به جمنای ارسال می‌شود تا ترجمه شود.
5. **انتشار**: اخبار ترجمه شده در کانال تلگرام منتشر می‌شوند.

## نکات

- در فایل `config.js` می‌توانید انتخاب‌گرهای CSS را برای منابع مختلف خبری تنظیم کنید.
- پرامپت‌های جمنای باید به گونه‌ای تنظیم شوند که خروجی JSON با فرمت مناسب تولید کنند.
- برخی سایت‌های خبری دارای محافظت CloudFlare هستند که ممکن است نیاز به تنظیمات بیشتری داشته باشند.


```bash
#!/bin/bash

# Music Scraper, Translator and Publisher Automation Script
# This script automates the process of scraping, processing, translating and publishing Music
# It runs every 10 minutes and only operates between 8 AM and midnight

# Set path to project directory
LOG_FILE="logs/process_$(date +\%Y\%m\%d).log"

# Load environment variables and PATH
# This helps cron to recognize all commands like node, npm, etc.
if [ -f "$HOME/.profile" ]; then
    source "$HOME/.profile"
elif [ -f "$HOME/.bash_profile" ]; then
    source "$HOME/.bash_profile"
elif [ -f "$HOME/.bashrc" ]; then
    source "$HOME/.bashrc"
fi

# If you're using NVM, you might need this:
if [ -f "$HOME/.nvm/nvm.sh" ]; then
    source "$HOME/.nvm/nvm.sh"
    # Use specific Node version if needed
    # nvm use default > /dev/null 2>&1
fi


# Create logs directory if it doesn't exist
mkdir -p "logs"

# Function to log messages with timestamp
log_message() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$LOG_FILE"
}

# Function to check if current time is within allowed operation hours (8:00 AM to 12:00 AM)
is_operation_allowed() {
    # Get current hour in Tehran timezone (IRST - Iran Standard Time)
    current_hour=$(TZ="Asia/Tehran" date +\%H)
    if [ "$current_hour" -lt 8 ] || [ "$current_hour" -ge 24 ]; then
        return 1  # Outside operation hours
    else
        return 0  # Within operation hours
    fi
}

# Check if we should run the operations based on time
if ! is_operation_allowed; then
    log_message "Outside operation hours (8:00-24:00). Skipping execution."
    exit 0
fi


# Function to run a command and log its output
run_command() {
    local command="$1"
    local description="$2"
    
    log_message "Starting $description..."
    
    # Execute command and capture both stdout and stderr
    output=$(eval "$command" 2>&1)
    exit_code=$?
    
    if [ $exit_code -eq 0 ]; then
        log_message "Successfully completed $description"
        log_message "Output: $output"
    else
        log_message "ERROR: Failed to execute $description. Exit code: $exit_code"
        log_message "Output: $output"
    fi
    
    # Small delay between operations
    sleep 2
    
    return $exit_code
}

# Start the process
log_message "Starting Music processing cycle"

# Step 1: Scrape Music from sources
run_command "node index.js read all" "Music scraping"

# Step 2: Process pending Music (analyze with Gemini AI)
run_command "node index.js pending" "Music analysis"

# Step 3: Translate approved Music
run_command "node index.js translate" "Music translation"

# Step 4: Publish translated Music to Telegram
if is_operation_allowed; then
    run_command "npm run publish" "Music publishing"
else
    log_message "Operation hours ended during execution. Skipping publishing."
fi

# Step 5: clear old translations
run_command "node index.js clear" "Music clear"

log_message "Completed Music processing cycle"
exit 0
```

```chmod +x Music_scraper_cron.sh
./Music_scraper_cron.sh```

```*/10 * * * * /path/to/Music_scraper_cron.sh```