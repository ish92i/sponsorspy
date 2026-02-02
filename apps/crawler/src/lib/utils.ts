export function isSocialLink(url: string): boolean {
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, "");
    const socialDomains = [
      "youtube.com", "youtu.be",
      "twitter.com", "x.com",
      "instagram.com",
      "facebook.com", "fb.com",
      "linkedin.com",
      "tiktok.com",
      "twitch.tv",
      "discord.gg", "discord.com",
      "reddit.com",
      "pinterest.com",
      "snapchat.com",
      "t.me", "telegram.org",
      "whatsapp.com",
      "patreon.com",
      "linktr.ee",
      "ko-fi.com", // Often a "sponsor" but usually a donation link, not a brand deal.
      "buymeacoffee.com",
      "spotify.com",
      "soundcloud.com",
      "apple.com", // music.apple.com
      "merch", // generic merch keyword check might be needed in path
      "app.link", // Deep linking service
      "onelink.me", // AppsFlyer OneLink
      "bit.ly", "short.link", "ow.ly", // Shorteners
    ];
    
    // Check for exact matches or subdomains
    return socialDomains.some(d => hostname === d || hostname.endsWith("." + d));
  } catch (e) {
    return false;
  }
}

export function extractFirstLink(text: string): string | null {
  if (!text) return null;
  // Regex to find URLs
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const matches = text.match(urlRegex);
  if (!matches) return null;

  for (const url of matches) {
    // Clean trailing punctuation often found in descriptions (e.g. "Visit https://site.com.")
    const cleanUrl = url.replace(/[.,;)]+$/, "");
    if (!isSocialLink(cleanUrl)) {
      return cleanUrl;
    }
  }
  return null;
}

export function normalizeDomain(url: string): string {
  try {
    const u = new URL(url);
    let hostname = u.hostname.replace(/^www\./, "").toLowerCase();
    
    // Extract root domain from subdomains (e.g., "onboarding.rocketmoney.com" -> "rocketmoney.com")
    const parts = hostname.split(".");
    if (parts.length > 2) {
      // Keep only the last two parts (domain.tld)
      hostname = parts.slice(-2).join(".");
    }
    
    return hostname;
  } catch (e) {
    return "";
  }
}

export async function followRedirects(url: string, maxRedirects = 5): Promise<string> {
  let currentUrl = url;
  let count = 0;
  
  while (count < maxRedirects) {
    try {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), 3000); // 3s timeout per hop

      const res = await fetch(currentUrl, {
        method: "HEAD",
        redirect: "manual",
        signal: controller.signal
      });
      clearTimeout(id);

      if (res.status >= 300 && res.status < 400) {
        const location = res.headers.get("location");
        if (location) {
          // Handle relative redirects
          currentUrl = new URL(location, currentUrl).toString();
          count++;
          continue;
        }
      }
      
      // If we are here, it's not a standard HTTP redirect. 
      // It might be a JS redirect or success.
      // For a worker, fully parsing HTML for meta refresh is heavy, but let's do a quick check if it's 200.
      // If it's a known shortener (bit.ly, etc) and returned 200 without location, it might be an interstitial page.
      // But 'HEAD' requests often skip the body.
      // If we suspect it's a JS redirect, we'd need a full GET and regex parsing.
      // For now, let's assume HTTP redirects cover 90% of cases.
      break;
    } catch (e) {
      // If fetch fails (timeout/network), just return what we have.
      break;
    }
  }
  return currentUrl;
}

function levenshteinDistance(str1: string, str2: string): number {
  const track = Array(str2.length + 1).fill(null).map(() =>
    Array(str1.length + 1).fill(null)
  );

  for (let i = 0; i <= str1.length; i += 1) {
    track[0][i] = i;
  }
  for (let j = 0; j <= str2.length; j += 1) {
    track[j][0] = j;
  }

  for (let j = 1; j <= str2.length; j += 1) {
    for (let i = 1; i <= str1.length; i += 1) {
      const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
      track[j][i] = Math.min(
        track[j][i - 1] + 1,
        track[j - 1][i] + 1,
        track[j - 1][i - 1] + indicator
      );
    }
  }

  return track[str2.length][str1.length];
}

export function isYoutuberOwnDomain(domain: string, youtuberName: string): boolean {
  // Normalize both strings
  const normalizedDomain = domain.toLowerCase().replace(/^www\./, "");
  const normalizedName = youtuberName.toLowerCase();

  // Remove special characters and spaces from the YouTuber name
  const nameVariations = [
    normalizedName,
    normalizedName.replace(/\s+/g, ""),
    normalizedName.replace(/[^a-z0-9]/g, "")
  ];

  for (const variation of nameVariations) {
    // Check for exact substring match (e.g., "mrbeast" in "mrbeast.store")
    if (normalizedDomain.includes(variation) && variation.length > 2) {
      // Additional check: make sure it's a significant portion of the domain
      // If domain starts or is mostly the YouTuber name, likely their own site
      const domainWithoutTld = normalizedDomain.split(".")[0];
      if (domainWithoutTld.includes(variation) || variation.includes(domainWithoutTld)) {
        return true;
      }
    }

    // Levenshtein distance check for typos (e.g., "mrbeast" vs "mrbeast")
    if (variation.length > 3) {
      const distance = levenshteinDistance(variation, normalizedDomain.split(".")[0]);
      const similarity = 1 - distance / Math.max(variation.length, normalizedDomain.split(".")[0].length);
      if (similarity > 0.85) {
        // Very similar, likely own domain
        return true;
      }
    }
  }

  return false;
}
