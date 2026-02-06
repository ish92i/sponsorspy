import { YtdlCore } from "@ybd-project/ytdl-core/serverless";

export interface ChannelInfo {
  id: string;
  channelName: string;
  youtubeHandle: string;
  channelPfp: string;
  channelUrl: string;
  subscribers: number;
  avgViews: number; // Calculated later
  avgLikes: number; // Calculated later
  _rawSubText?: string; 
}

export interface VideoInfo {
  id: string;
  title: string;
  thumbnail: string;
  viewCount: number;
  likeCount: number;
  uploadDate: number; // timestamp
  description: string;
  url: string;
}

export class YouTubeProvider {
  private ytdl: YtdlCore;

  constructor() {
    this.ytdl = new YtdlCore({
      clients: ['WEB']
    });
  }

  async getChannelVideos(handle: string): Promise<{ channel: ChannelInfo, videos: string[] }> {
    const url = `https://www.youtube.com/${handle.startsWith("@") ? handle : "@" + handle}/videos`;
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9"
      }
    });
    const html = await res.text();

    const jsonMatch = html.match(/var ytInitialData = ({.*?});/s);
    if (!jsonMatch || !jsonMatch[1]) {
      throw new Error("Could not parse YouTube channel data");
    }
    const data = JSON.parse(jsonMatch[1]);

    const header = data.header?.c4TabbedHeaderRenderer || 
                   data.header?.pageHeaderRenderer?.content?.pageHeaderViewModel ||
                   data.metadata?.channelMetadataRenderer;
                   
    if (!header) throw new Error("Channel header not found");

    const channelId = header.channelId || data.metadata?.channelMetadataRenderer?.externalId || "";
    const name = this.extractText(header.title) || this.extractText(header.channelName) || "";
    
    // Robust PFP Extraction for both old and new UIs
    const pfp = header.avatar?.thumbnails?.[0]?.url || 
                header.image?.imageViewModel?.image?.sources?.[0]?.url || 
                data.metadata?.channelMetadataRenderer?.avatar?.thumbnails?.[0]?.url ||
                "";
    
    // Subscriber Count Logic
    let subText = this.extractText(header.subscriberCountText);
    
    if (!subText && header.metadata?.contentMetadataViewModel?.metadataRows) {
        const rows = header.metadata.contentMetadataViewModel.metadataRows;
        for (const row of rows) {
            for (const part of row.metadataParts || []) {
                const text = part.text?.content || "";
                const lower = text.toLowerCase();
                if (lower.includes("abonnés") || lower.includes("subscribers") || lower.includes("subs")) {
                    subText = text;
                    break;
                }
            }
        }
    }

    if (!subText) {
        const findSubString = (obj: any): string => {
            if (!obj) return "";
            if (typeof obj === 'string' && (obj.includes("abonnés") || obj.includes("subscribers"))) return obj;
            if (typeof obj === 'object') {
                for (const key in obj) {
                    const res = findSubString(obj[key]);
                    if (res) return res;
                }
            }
            return "";
        };
        subText = findSubString(header) || findSubString(data.metadata) || "";
    }

    const subscribers = this.parseCount(subText);

    return {
      channel: {
        id: channelId,
        channelName: name,
        youtubeHandle: handle,
        channelPfp: pfp,
        channelUrl: `https://www.youtube.com/${handle}`,
        subscribers,
        avgViews: 0,
        avgLikes: 0,
        _rawSubText: subText
      },
      videos: videoIdsFromTab(data)
    };
  }

  private extractText(obj: any): string {
    if (!obj) return "";
    if (typeof obj === 'string') return obj;
    if (obj.simpleText) return obj.simpleText;
    if (obj.runs && Array.isArray(obj.runs)) return obj.runs.map((r: any) => r.text).join("");
    if (obj.content) return obj.content;
    if (obj.dynamicTextViewModel?.text?.content) return obj.dynamicTextViewModel.text.content;
    return "";
  }

  async getVideoDetails(videoId: string): Promise<VideoInfo> {
    const url = `https://www.youtube.com/watch?v=${videoId}`;
    try {
      const info = await this.ytdl.getBasicInfo(url, {
        includesNextAPIResponse: true
      });
      const details = info.videoDetails as any;

      // Extract likes
      const likeCount = typeof details.likes === 'number' ? details.likes : (this.parseCount(details.likes?.toString()) || 0);

      return {
        id: videoId,
        title: details.title,
        thumbnail: details.thumbnails[0]?.url || "",
        viewCount: typeof details.viewCount === 'string' ? parseInt(details.viewCount) : (details.viewCount || 0),
        likeCount: likeCount, 
        uploadDate: details.publishDate ? new Date(details.publishDate).getTime() : 0,
        description: details.description || "",
        url: details.video_url || details.videoUrl
      };
    } catch (e) {
      console.error(`Failed to get details for ${videoId}:`, e);
      throw e;
    }
  }

  private parseCount(str: string | undefined): number {
    if (!str) return 0;
    
    // 1. Normalize
    let clean = str.replace(/\u00A0/g, " ").toUpperCase();
    
    // 2. Isolate subscriber part if multiple metrics exist
    if (clean.includes("ABONNÉS")) clean = clean.split("ABONNÉS")[0] || "";
    else if (clean.includes("SUBSCRIBERS")) clean = clean.split("SUBSCRIBERS")[0] || "";
    else if (clean.includes("SUBS")) clean = clean.split("SUBS")[0] || "";

    // 3. Handle French spaces and commas (e.g. "331 500" or "1,23")
    // Replace comma with dot for parseFloat
    clean = clean.replace(",", ".");
    
    // 4. Extract the number and multiplier
    // Look for digits, potential dot, then optional space, then optional K/M/B
    const match = clean.match(/(\d+(?:\.\d+)?)\s*([KMB])?/);
    if (!match) return 0;

    const val = parseFloat(match[1] || "0");
    const mult = match[2] || "";
    
    const multipliers: { [key: string]: number } = { 'K': 1000, 'M': 1000000, 'B': 1000000000 };
    return Math.floor(val * (multipliers[mult] || 1));
  }
}

function videoIdsFromTab(data: any): string[] {
  const tabs = data.contents?.twoColumnBrowseResultsRenderer?.tabs;
  const videoTab = tabs?.find((t: any) => t.tabRenderer?.selected || t.tabRenderer?.title === "Vidéos" || t.tabRenderer?.title === "Videos");
  const contents = videoTab?.tabRenderer?.content?.richGridRenderer?.contents || 
                   videoTab?.tabRenderer?.content?.sectionListRenderer?.contents?.[0]?.itemSectionRenderer?.contents?.[0]?.gridRenderer?.items;

  const videoIds: string[] = [];
  if (contents) {
    for (const item of contents) {
      const video = item.richItemRenderer?.content?.videoRenderer || item.videoRenderer || item.gridVideoRenderer;
      if (video && video.videoId) {
        videoIds.push(video.videoId);
      }
    }
  }
  return videoIds;
}