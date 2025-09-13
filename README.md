# News Scraper, Translator and Publisher

This project is a complete system for scraping news data, translating, and publishing news to Telegram channels.

## Features

- Scraping news data from multiple global news sources
- Storing news in SQLite database
- Reviewing and filtering news using Gemini AI
- Extracting complete news content and images
- Translating news using Gemini AI
- Publishing translated news to Telegram channels
- Managing different news states (pending review, pending translation, translated, published)

## Prerequisites

- Node.js (version 14 or higher)
- Gemini API key
- Telegram bot token

## Installation

1. Clone the repository
```bash
git clone https://github.com/habibi-dev/ap-news-scraper.git
cd ap-news-scraper
```

2. Install dependencies
```bash
npm install
```

3. Configure settings in `config.js` file
    - Enter Gemini API key
    - Enter Telegram bot token and channel ID
    - Set translation and review prompts

## Usage

### Scraping News Data
```bash
npm run read
# or for specific source
node index.js scrape bbc
```

### Process Pending News
```bash
npm run pending
```

### Translate News
```bash
npm run translate
```

### Publish Translated News
```bash
npm run publish
```

## Project Structure

```
/project
├── index.js                  # Main file for running the application
├── config.js                 # Application settings
├── package.json              # Project dependencies
├── /services
│   ├── scraper.js            # Web scraper service
│   ├── newsService.js        # News management service
│   ├── telegram.js           # Telegram sending service
├── /db
│   ├── newsDatabase.js       # Database operations
├── /utils
│   ├── helpers.js            # Helper functions like delay
├── /api
│   ├── geminiApi.js          # Gemini API communication
```

## Overall Process

1. **Scraping**: News is collected from various sources and stored in the database.
2. **Review**: News headlines are sent to Gemini to check their suitability for translation.
3. **Content Extraction**: Complete content of approved news is extracted.
4. **Translation**: Complete news content is sent to Gemini for translation.
5. **Publishing**: Translated news is published to Telegram channels.

## Notes

- In the `config.js` file, you can set CSS selectors for different news sources.
- Gemini prompts should be configured to produce JSON output in the appropriate format.
- Some news websites have CloudFlare protection which may require additional configurations.

## Automation Script

```bash
#!/bin/bash

# News Scraper, Translator and Publisher Automation Script
# This script automates the process of scraping, processing, translating and publishing news
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
log_message "Starting news processing cycle"

# Step 1: Scrape news from sources
run_command "node index.js read all" "news scraping"

# Step 2: Process pending news (analyze with Gemini AI)
run_command "node index.js pending" "news analysis"

# Step 3: Translate approved news
run_command "node index.js translate" "news translation"

# Step 4: Publish translated news to Telegram
if is_operation_allowed; then
    run_command "npm run publish" "news publishing"
else
    log_message "Operation hours ended during execution. Skipping publishing."
fi

# Step 5: Clear old translations
run_command "node index.js clear" "news clear"

log_message "Completed news processing cycle"
exit 0
```

### Setting up the automation script:

1. Make the script executable:
```bash
chmod +x news_scraper_cron.sh
./news_scraper_cron.sh
```

2. Add to crontab to run every 10 minutes:
```bash
*/10 * * * * /path/to/news_scraper_cron.sh
```

## Operation Schedule

The system operates between 8:00 AM and 12:00 AM (midnight) Tehran time. Outside these hours, the script will skip execution to avoid unnecessary operations during low-activity periods.
