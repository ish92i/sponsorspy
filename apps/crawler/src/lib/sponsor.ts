export interface SponsorData {
  name: string;
  logo: string;
  website: string;
}

export async function getCompanyData(
  domain: string,
  secretKey: string,
  publishableKey: string
): Promise<SponsorData | null> {
  if (!domain) return null;

  // Initial fallback data
  const fallback: SponsorData = {
    name: domain.split('.')[0].charAt(0).toUpperCase() + domain.split('.')[0].slice(1),
    logo: `https://img.logo.dev/${domain}?token=${publishableKey}`,
    website: `https://${domain}`
  };

  if (!secretKey || secretKey === "your_logo_dev_key_here") {
    return fallback;
  }

  try {
    const res = await fetch(`https://api.logo.dev/describe/${domain}`, {
      headers: {
        "Authorization": `Bearer ${secretKey}`
      }
    });

    if (!res.ok) {
      return fallback;
    }

    const data = await res.json() as any;
    
    return {
      name: data.name || fallback.name,
      logo: `https://img.logo.dev/${domain}?token=${publishableKey}`,
      website: `https://${domain}`
    };
  } catch (e) {
    console.error(`Error fetching logo.dev for ${domain}:`, e);
    return fallback;
  }
}
