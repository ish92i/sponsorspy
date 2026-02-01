export interface SponsorData {
  name: string;
  description: string;
  logo: string;
  website: string;
}

export async function getCompanyData(domain: string, apiKey: string): Promise<SponsorData | null> {
  if (!domain) return null;

  // Initial fallback data
  const fallback: SponsorData = {
    name: domain.split('.')[0].charAt(0).toUpperCase() + domain.split('.')[0].slice(1),
    description: "",
    logo: `https://img.logo.dev/${domain}?token=${apiKey}`,
    website: `https://${domain}`
  };

  if (!apiKey || apiKey === "your_logo_dev_key_here") {
    return fallback;
  }

  try {
    const res = await fetch(`https://api.logo.dev/describe/${domain}`, {
      headers: {
        "Authorization": `Bearer ${apiKey}`
      }
    });

    if (!res.ok) {
      return fallback;
    }

    const data = await res.json() as any;
    
    return {
      name: data.name || fallback.name,
      description: data.description || "",
      logo: data.logo || fallback.logo,
      website: data.website || fallback.website
    };
  } catch (e) {
    console.error(`Error fetching logo.dev for ${domain}:`, e);
    return fallback;
  }
}
