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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const Route = createFileRoute("/sponsors/$sponsorId")({
  component: SponsorProfilePage,
});

const formatMetric = (value?: number) => {
  if (!value) return "—";
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}k`;
  return value.toString();
};

function SponsorProfilePage() {
  const { sponsorId } = Route.useParams();
  const sponsorQuery = useQuery(
    convexQuery(api.search.getSponsorProfile, {
      id: sponsorId as Id<"sponsors">,
    }),
  );
  const profile = sponsorQuery.data;

  if (sponsorQuery.isLoading) {
    return <div className="container mx-auto px-4 py-6">Loading sponsor profile...</div>;
  }

  if (!profile) {
    return <div className="container mx-auto px-4 py-6">Sponsor not found.</div>;
  }

  return (
    <div className="container mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-6">
      <Card>
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <Avatar className="h-14 w-14">
              <AvatarImage src={profile.sponsor.logo} alt={profile.sponsor.name} />
              <AvatarFallback>{profile.sponsor.name.slice(0, 2).toUpperCase()}</AvatarFallback>
            </Avatar>
            <div>
              <p className="text-muted-foreground text-sm">Sponsor profile</p>
              <CardTitle className="text-2xl">{profile.sponsor.name}</CardTitle>
              <a
                className="text-muted-foreground text-sm underline-offset-4 hover:underline"
                href={profile.sponsor.website}
                target="_blank"
                rel="noreferrer"
              >
                {profile.sponsor.website}
              </a>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary">Active partner</Badge>
            <Button asChild variant="outline">
              <Link to="/">Back to search</Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent className="grid gap-6 md:grid-cols-[1.2fr_1fr]">
          <div className="space-y-3">
            <p className="text-sm font-medium">Overview</p>
            <p className="text-muted-foreground text-sm">
              Track brand partnerships, recurring sponsorships, and recent creator activations.
              Profiles are sourced from Convex data.
            </p>
            <Separator />
            <div className="grid gap-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">First seen</span>
                <span>{new Date(profile.sponsor.firstSeen).toLocaleDateString()}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Last seen</span>
                <span>{new Date(profile.sponsor.lastSeen).toLocaleDateString()}</span>
              </div>
            </div>
          </div>
          <div className="grid gap-3">
            <Card className="border-dashed">
              <CardContent className="grid gap-2 p-4">
                <p className="text-muted-foreground text-xs uppercase tracking-wide">
                  Active creators
                </p>
                <p className="text-3xl font-semibold">{profile.creators.length}</p>
              </CardContent>
            </Card>
            <Card className="border-dashed">
              <CardContent className="grid gap-2 p-4">
                <p className="text-muted-foreground text-xs uppercase tracking-wide">
                  Avg subscribers
                </p>
                <p className="text-3xl font-semibold">
                  {formatMetric(
                    profile.creators.reduce((total, creator) => total + creator.subscribers, 0) /
                      Math.max(profile.creators.length, 1),
                  )}
                </p>
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Creators sponsored</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Creator</TableHead>
                <TableHead>Subscribers</TableHead>
                <TableHead>Avg views</TableHead>
                <TableHead>Videos sponsored</TableHead>
                <TableHead className="text-right">Profile</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {profile.creators.map((creator) => (
                <TableRow key={creator._id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar>
                        <AvatarImage src={creator.creatorPfp} alt={creator.creatorName} />
                        <AvatarFallback>{creator.creatorName.slice(0, 2).toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">{creator.creatorName}</p>
                        <p className="text-muted-foreground text-xs">{creator.creatorHandle}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>{formatMetric(creator.subscribers)}</TableCell>
                  <TableCell>{formatMetric(creator.avgViews)}</TableCell>
                  <TableCell>{creator.videoCount}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="outline" size="sm" asChild>
                      <Link to="/youtubers/$youtuberId" params={{ youtuberId: creator.creatorId }}>
                        View
                      </Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
