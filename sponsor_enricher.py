"""
Sponsor Enricher - Extracts company names and logos from domains.
Bypasses Cloudflare using cloudscraper.

Usage:
    uv add cloudscraper beautifulsoup4
    uv run sponsor_enricher.py nordvpn.com shopify.com
"""

import re
import json
import sys

# Try cloudscraper first, fallback to requests
try:
    import cloudscraper
    scraper = cloudscraper.create_scraper(browser={'browser': 'chrome', 'platform': 'windows', 'mobile': False})
    USE_CLOUDSCRAPER = True
except ImportError:
    import requests
    scraper = requests.Session()
    USE_CLOUDSCRAPER = False
    print("[WARN] cloudscraper not installed. Run: uv add cloudscraper")

from bs4 import BeautifulSoup


def clean_company_name(name, domain):
    """
    Cleans a raw site title into a professional company name.
    Example: 'NordVPN: The best VPN service' -> 'NordVPN'
    """
    if not name or not isinstance(name, str):
        return domain.split('.')[0].capitalize()

    original_name = name.strip()
    domain_keyword = domain.split('.')[0].lower()

    # Split by common delimiters and find the part with the domain keyword
    delimiters = ['|', '–', '—', ' - ', ':']
    for d in delimiters:
        if d in name:
            parts = [p.strip() for p in name.split(d) if p.strip()]
            # First, look for a part that contains the domain keyword
            for part in parts:
                if domain_keyword in part.lower():
                    name = part
                    break
            else:
                # If no part contains domain keyword, pick the shortest non-generic part
                non_generic = [p for p in parts if len(p) > 2 and p.lower() not in ['home', 'welcome', 'official site']]
                if non_generic:
                    name = min(non_generic, key=len)
                else:
                    name = parts[0]
            break

    # Remove generic phrases (be careful not to remove too much)
    generic_patterns = [
        r'^Welcome to\s+',
        r'\s*[\-–—]\s*Official Site$',
        r'\s*[\-–—]\s*Home$',
        r'\s*\| Official.*$',
    ]
    for pattern in generic_patterns:
        name = re.sub(pattern, '', name, flags=re.IGNORECASE).strip()

    # If we ended up with something too short or empty, use original or domain
    if len(name) < 3:
        # Try to extract from original if it contains the domain keyword
        if domain_keyword in original_name.lower():
            # Find the word that contains the domain keyword
            words = original_name.split()
            for word in words:
                if domain_keyword in word.lower() and len(word) > 2:
                    return word.strip('.,!?:;')
        return domain.split('.')[0].capitalize()

    return name


def enrich_sponsor(domain, logo_token=""):
    """
    Fetches the domain and extracts metadata to find a company name, logo, and description.
    """
    url = f"https://{domain}"

    result = {
        "domain": domain,
        "name": domain.split('.')[0].capitalize(),
        "logo_url": f"https://img.logo.dev/{domain}?token={logo_token}" if logo_token else f"https://img.logo.dev/{domain}",
        "description": "",
        "website": url,
        "source": "domain_guess"
    }
    # Note: logo_url always uses Logo.dev - it's reliable and consistent

    headers = {
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
    }

    try:
        method = "cloudscraper" if USE_CLOUDSCRAPER else "requests"
        print(f"[*] Scraping {url} ({method})...")
        response = scraper.get(url, headers=headers, timeout=15, allow_redirects=True)

        if response.status_code == 403:
            print(f"[!] 403 Forbidden for {domain}")
            return result

        response.raise_for_status()

        soup = BeautifulSoup(response.text, 'html.parser')

        # Layered Name Extraction
        name_candidates = []
        desc_candidates = []

        # Priority 0: JSON-LD (Most accurate for business names)
        for script in soup.find_all("script", attrs={"type": "application/ld+json"}):
            try:
                data = json.loads(script.string) if script.string else None
                if isinstance(data, dict):
                    if data.get("@type") in ["Organization", "Brand", "WebSite", "Corporation"]:
                        if data.get("name"):
                            name_candidates.append(data.get("name"))
                        if data.get("description"):
                            desc_candidates.append(data.get("description"))
                elif isinstance(data, list):
                    for item in data:
                        if isinstance(item, dict) and item.get("@type") in ["Organization", "Brand", "WebSite", "Corporation"]:
                            if item.get("name"):
                                name_candidates.append(item.get("name"))
                            if item.get("description"):
                                desc_candidates.append(item.get("description"))
            except (json.JSONDecodeError, TypeError):
                continue

        # Priority 1: og:site_name (Usually very clean)
        og_site = soup.find("meta", attrs={"property": "og:site_name"})
        if og_site and og_site.get("content"):
            name_candidates.append(og_site.get("content"))

        # Priority 2: application-name
        app_name = soup.find("meta", attrs={"name": "application-name"})
        if app_name and app_name.get("content"):
            name_candidates.append(app_name.get("content"))

        # Priority 3: Page <title>
        if soup.title and soup.title.string:
            name_candidates.append(soup.title.string)

        # Description from meta
        meta_desc = soup.find("meta", attrs={"name": "description"})
        if meta_desc and meta_desc.get("content"):
            desc_candidates.append(meta_desc.get("content"))

        og_desc = soup.find("meta", attrs={"property": "og:description"})
        if og_desc and og_desc.get("content"):
            desc_candidates.append(og_desc.get("content"))

        # Pick and clean the best name
        for c in name_candidates:
            if c and isinstance(c, str) and len(c.strip()) > 2:
                cleaned = clean_company_name(c, domain)
                if cleaned and len(cleaned) > 2:
                    result["name"] = cleaned
                    result["source"] = "meta_scraping"
                    break

        # Logo is always Logo.dev (set in result initialization)

        # Pick best description (no truncation for storage, just for display)
        for desc in desc_candidates:
            if desc and isinstance(desc, str) and len(desc.strip()) > 10:
                result["description"] = desc.strip()
                break

    except Exception as e:
        print(f"[!] Error scraping {domain}: {e}")

    return result


if __name__ == "__main__":
    # Example usage: python sponsor_enricher.py nordvpn.com hellofresh.com
    domains = sys.argv[1:] if len(sys.argv) > 1 else ["nordvpn.com", "shopify.com", "surfshark.com"]

    print("=" * 90)
    
    for d in domains:
        data = enrich_sponsor(d)
        print(f"\n📦 {data['name']} ({data['domain']})")
        print(f"   🔗 Website: {data['website']}")
        print(f"   🖼️  Logo: {data['logo_url']}")
        print(f"   📝 Description: {data['description'] or '(none)'}")
        print(f"   📊 Source: {data['source']}")

    print("\n" + "=" * 90)
    if not USE_CLOUDSCRAPER:
        print("\n[TIP] For Cloudflare bypass: uv add cloudscraper")
