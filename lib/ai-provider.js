const RULE_CATEGORIES = [
  { pattern: /^(github\.com|gitlab\.com|bitbucket\.org|stackoverflow\.com|npmjs\.com|pypi\.org|docs\.python\.org|developer\.mozilla\.org|codepen\.io|codesandbox\.io|replit\.com|dev\.to|medium\.com|hashnode\.dev|leetcode\.com|hackerrank\.com|codeforces\.com)/i, category: "dev" },
  { pattern: /^(twitter\.com|x\.com|facebook\.com|instagram\.com|linkedin\.com|reddit\.com|discord\.com|slack\.com|web\.telegram\.org|whatsapp\.com|tiktok\.com|snapchat\.com|threads\.net|mastodon\.social|bsky\.app)/i, category: "social" },
  { pattern: /^(amazon\.|ebay\.|etsy\.|walmart\.|target\.|bestbuy\.|shopify\.|aliexpress\.|wish\.com|wayfair\.com|homedepot\.|lowes\.|costco\.|ikea\.)/i, category: "shopping" },
  { pattern: /^(youtube\.com|netflix\.com|twitch\.tv|hulu\.com|disneyplus\.com|spotify\.com|soundcloud\.com|vimeo\.com|dailymotion\.com|crunchyroll\.com|hbomax\.com|peacocktv\.com|paramountplus\.com|pinterest\.com)/i, category: "entertainment" },
  { pattern: /^(news\.|cnn\.com|bbc\.|reuters\.com|nytimes\.com|washingtonpost\.com|theguardian\.com|bbc\.co\.uk|apnews\.com|npr\.org|foxnews\.com|usatoday\.com|wsj\.com|ft\.com|economist\.com|wired\.com|techcrunch\.com|theverge\.com|arstechnica\.com)/i, category: "news" },
  { pattern: /^(docs\.google\.|notion\.so|confluence\.|jira\.|trello\.|asana\.|figma\.|airtable\.|evernote\.com|onenote\.|obsidian\.md|coda\.io|slite\.com|quip\.com|dropbox\.paper)/i, category: "docs" },
  { pattern: /^(mail\.google\.|outlook\.|protonmail\.|yahoo\.com\/mail|zoho\.com\/mail|aol\.com\/mail|icloud\.com\/mail|fastmail\.com)/i, category: "work" },
  { pattern: /^(calendar\.google\.|zoom\.us|meet\.google\.|teams\.microsoft\.|webex\.com|miro\.com|monday\.com|clickup\.com|basecamp\.com|atlassian\.net|linear\.app|height\.app|shortcut\.com)/i, category: "work" },
  { pattern: /^(drive\.google\.|dropbox\.|box\.com|onedrive\.|icloud\.drive|wetransfer\.com|sharepoint\.com)/i, category: "work" },
  { pattern: /^(chat\.google\.|hangouts\.google\.|messages\.google\.|web\.whatsapp\.com|skype\.com|teamwork\.com)/i, category: "work" },
  { pattern: /^(bank|banking|chase\.com|wellsfargo\.com|bankofamerica\.com|capitalone\.com|amex\.com|paypal\.com|venmo\.com|revolut\.com|wise\.com|robinhood\.com|coinbase\.com)/i, category: "finance" },
  { pattern: /^(kayak\.|expedia\.|booking\.|airbnb\.|tripadvisor\.|skyscanner\.|hotels\.com|priceline\.)/i, category: "travel" },
  { pattern: /^(portal\.|canvas\.|blackboard\.|classroom\.google\.|khanacademy\.|coursera\.|udemy\.|edx\.org|skillshare\.|pluralsight\.|codecademy\.)/i, category: "learning" },
  { pattern: /^(healthline\.com|webmd\.com|mayoclinic\.org|myfitnesspal\.com|strava\.com|fitbit\.com|weightwatchers\.com)/i, category: "health" },
];

function ruleBasedCategorize(url) {
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, "");
    for (const { pattern, category } of RULE_CATEGORIES) {
      if (pattern.test(hostname)) return category;
    }
    return null;
  } catch {
    return null;
  }
}

async function chromeAICategorize(items) {
  if (!window.ai?.languageModel) return null;
  try {
    const capabilities = await window.ai.languageModel.capabilities();
    if (capabilities.available !== "readily") return null;

    const session = await window.ai.languageModel.createSession({
      systemPrompt: "You categorize browser tabs. Respond with ONLY a JSON array. No other text.",
    });

    try {
      const prompt = `Categorize each tab into ONE of: work, social, shopping, entertainment, news, docs, dev, finance, travel, learning, health, other.

Rules:
- work = email, calendar, meetings, project management, cloud drives, office tools
- dev = code repos, developer docs, Stack Overflow, developer tools
- social = social media, messaging, forums, communities
- shopping = e-commerce, product pages, online stores
- entertainment = video, music, streaming, games, creative portfolios
- news = news sites, articles, blogs, tech publications
- docs = documents, wikis, notes, design tools, collab editors
- finance = banking, payments, investing, crypto
- travel = flights, hotels, trip planning
- learning = courses, education, tutorials
- health = fitness, medical, wellness
- other = anything else

Return ONLY a JSON array: [{"id": 123, "category": "dev"}, ...]

Tabs:
${JSON.stringify(items)}`;

      const response = await session.prompt(prompt);
      const match = response.match(/\[[\s\S]*?\]/);
      return match ? JSON.parse(match[0]) : null;
    } finally {
      session.destroy();
    }
  } catch {
    return null;
  }
}

async function categorizeTabs(tabs) {
  const ruleResults = tabs.map((tab) => ({
    tab,
    category: ruleBasedCategorize(tab.url),
  }));

  const uncategorized = ruleResults.filter((r) => r.category === null);
  if (uncategorized.length === 0) {
    return ruleResults.map((r) => ({ tab: r.tab, category: r.category || "other" }));
  }

  try {
    const items = uncategorized.map((r) => ({ id: r.tab.id, url: r.tab.url, title: r.tab.title }));
    const parsed = await chromeAICategorize(items);
    if (Array.isArray(parsed)) {
      const aiMap = new Map(parsed.map((r) => [r.id, r.category]));
      for (const r of ruleResults) {
        if (r.category === null && aiMap.has(r.tab.id)) {
          r.category = aiMap.get(r.tab.id);
        }
      }
    }
  } catch {}

  return ruleResults.map((r) => ({ tab: r.tab, category: r.category || "other" }));
}

async function checkChromeAIAvailability() {
  if (!window.ai?.languageModel) return { available: false, reason: "not_supported" };
  try {
    const caps = await window.ai.languageModel.capabilities();
    if (caps.available === "readily") return { available: true };
    if (caps.available === "after-download") return { available: false, reason: "download_required" };
    return { available: false, reason: "not_available" };
  } catch {
    return { available: false, reason: "error" };
  }
}

export { ruleBasedCategorize, categorizeTabs, checkChromeAIAvailability };