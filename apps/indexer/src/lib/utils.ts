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
    return u.hostname.replace(/^www\./, "").toLowerCase();
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
