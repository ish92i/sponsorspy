import { convexQuery } from "@convex-dev/react-query";
import type { Id } from "@sponsorspy/backend/convex/_generated/dataModel";
import { api } from "@sponsorspy/backend/convex/_generated/api";
import { useQuery } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

export const Route = createFileRoute("/youtubers/$youtuberId")({
  component: YoutuberProfilePage,
});

const formatMetric = (value?: number) => {
  if (!value) return "—";
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}k`;
  return value.toString();
};

function YoutuberProfilePage() {
  const { youtuberId } = Route.useParams();
  const profileQuery = useQuery(
    convexQuery(api.search.getCreatorProfile, {
      id: youtuberId as Id<"creators">,
    }),
  );
  const profile = profileQuery.data;

  if (profileQuery.isLoading) {
    return <div className="container mx-auto px-4 py-6">Loading creator profile...</div>;
  }

  if (!profile) {
    return <div className="container mx-auto px-4 py-6">Creator not found.</div>;
  }

  return (
    <div className="container mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6">
      <Card>
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16">
              <AvatarImage src={profile.creator.channelPfp} alt={profile.creator.channelName} />
              <AvatarFallback>{profile.creator.channelName.slice(0, 2).toUpperCase()}</AvatarFallback>
            </Avatar>
            <div>
              <p className="text-muted-foreground text-sm">YouTuber profile</p>
              <CardTitle className="text-2xl">{profile.creator.channelName}</CardTitle>
              <p className="text-muted-foreground text-sm">{profile.creator.youtubeHandle}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary">Sponsorship ready</Badge>
            <Button asChild variant="outline">
              <Link to="/">Back to search</Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent className="grid gap-6 md:grid-cols-[1.6fr_1fr]">
          <div className="space-y-4">
            <p className="text-muted-foreground text-sm">
              Sponsorship insights are aggregated from Convex, including creator-level stats and
              recent videos tagged with brand integrations.
            </p>
            <Separator />
            <div className="grid gap-4 sm:grid-cols-3">
              <Card className="border-dashed">
                <CardContent className="grid gap-2 p-4">
                  <p className="text-muted-foreground text-xs uppercase tracking-wide">Subscribers</p>
                  <p className="text-2xl font-semibold">{formatMetric(profile.creator.subscribers)}</p>
                </CardContent>
              </Card>
              <Card className="border-dashed">
                <CardContent className="grid gap-2 p-4">
                  <p className="text-muted-foreground text-xs uppercase tracking-wide">Avg views</p>
                  <p className="text-2xl font-semibold">{formatMetric(profile.creator.avgViews)}</p>
                </CardContent>
              </Card>
              <Card className="border-dashed">
                <CardContent className="grid gap-2 p-4">
                  <p className="text-muted-foreground text-xs uppercase tracking-wide">Avg likes</p>
                  <p className="text-2xl font-semibold">{formatMetric(profile.creator.avgLikes)}</p>
                </CardContent>
              </Card>
            </div>
          </div>
          <div className="grid gap-3">
            <Card className="border-dashed">
              <CardContent className="grid gap-2 p-4">
                <p className="text-muted-foreground text-xs uppercase tracking-wide">
                  Sponsors worked with
                </p>
                <p className="text-3xl font-semibold">{profile.sponsors.length}</p>
              </CardContent>
            </Card>
            <Card className="border-dashed">
              <CardContent className="grid gap-2 p-4">
                <p className="text-muted-foreground text-xs uppercase tracking-wide">Last checked</p>
                <p className="text-lg font-semibold">
                  {new Date(profile.creator.lastChecked).toLocaleDateString()}
                </p>
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>
      <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Recent sponsored videos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {profile.recentVideos.length === 0 && (
              <p className="text-muted-foreground text-sm">No sponsored videos yet.</p>
            )}
            {profile.recentVideos.map((video) => (
              <div key={video._id} className="flex gap-4 rounded-lg border p-3">
                <img
                  src={video.thumbnail}
                  alt={video.title}
                  className="h-20 w-32 rounded-md object-cover"
                />
                <div className="space-y-2">
                  <p className="font-medium">{video.title}</p>
                  <p className="text-muted-foreground text-xs">
                    {formatMetric(video.viewCount)} views • {formatMetric(video.likeCount)} likes
                  </p>
                  <Button variant="link" className="h-auto p-0" asChild>
                    <a href={video.link} target="_blank" rel="noreferrer">
                      Watch on YouTube
                    </a>
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Brands partnered with</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {profile.sponsors.map((sponsor) => (
              <div key={sponsor._id} className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <Avatar>
                    <AvatarImage src={sponsor.sponsorLogo} alt={sponsor.sponsorName} />
                    <AvatarFallback>{sponsor.sponsorName.slice(0, 2).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium">{sponsor.sponsorName}</p>
                    <p className="text-muted-foreground text-xs">{sponsor.sponsorWebsite}</p>
                  </div>
                </div>
                <Button variant="outline" size="sm" asChild>
                  <Link to="/sponsors/$sponsorId" params={{ sponsorId: sponsor.sponsorId }}>
                    View
                  </Link>
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
