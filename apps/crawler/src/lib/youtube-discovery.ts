export class YouTubeDiscovery {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async findRelatedChannels(channelId: string, limit: number = 10): Promise<string[]> {
    try {
      // Search for videos from this channel
      const videosRes = await fetch(
        `https://www.googleapis.com/youtube/v3/search?part=id&channelId=${channelId}&type=video&maxResults=5&key=${this.apiKey}`
      );

      if (!videosRes.ok) {
        throw new Error(`YouTube API error: ${videosRes.statusText}`);
      }

      const videosData = (await videosRes.json()) as any;
      const videoIds = videosData.items?.map((item: any) => item.id.videoId) || [];

      if (videoIds.length === 0) {
        return [];
      }

      // For each video, find related videos
      const relatedChannels = new Set<string>();

      for (const videoId of videoIds.slice(0, 3)) {
        try {
          const relatedRes = await fetch(
            `https://www.googleapis.com/youtube/v3/search?part=snippet&relatedToVideoId=${videoId}&type=channel&maxResults=${limit}&key=${this.apiKey}`
          );

          if (!relatedRes.ok) continue;

          const relatedData = (await relatedRes.json()) as any;
          const channels = relatedData.items?.map((item: any) => item.snippet?.channelId) || [];

          channels.forEach((ch: string) => {
            if (ch && ch !== channelId) {
              relatedChannels.add(ch);
            }
          });

          if (relatedChannels.size >= limit) {
            break;
          }
        } catch {
          // Continue to next video
        }
      }

      // Convert channel IDs to handles by fetching channel info
      const handles: string[] = [];
      for (const channelId of Array.from(relatedChannels).slice(0, limit)) {
        try {
          const channelRes = await fetch(
            `https://www.googleapis.com/youtube/v3/channels?part=snippet&id=${channelId}&key=${this.apiKey}`
          );

          if (!channelRes.ok) continue;

          const channelData = (await channelRes.json()) as any;
          const channel = channelData.items?.[0];

          if (channel?.snippet?.customUrl) {
            // customUrl is the handle (with @ prefix)
            handles.push(channel.snippet.customUrl);
          }
        } catch {
          // Continue to next channel
        }
      }

      return handles;
    } catch (error) {
      console.error("Error finding related channels:", error);
      return [];
    }
  }

  async getChannelIdFromHandle(handle: string): Promise<string | null> {
    try {
      const cleanHandle = handle.startsWith("@") ? handle : `@${handle}`;
      const res = await fetch(
        `https://www.googleapis.com/youtube/v3/search?part=id&q=${encodeURIComponent(cleanHandle)}&type=channel&maxResults=1&key=${this.apiKey}`
      );

      if (!res.ok) {
        return null;
      }

      const data = (await res.json()) as any;
      return data.items?.[0]?.id?.channelId || null;
    } catch {
      return null;
    }
  }
}
