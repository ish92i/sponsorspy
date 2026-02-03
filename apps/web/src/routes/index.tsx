import { convexQuery } from "@convex-dev/react-query";
import { api } from "@sponsorspy/backend/convex/_generated/api";
import { useQuery } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Pagination, PaginationContent, PaginationItem, PaginationLink } from "@/components/ui/pagination";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/")({
  component: SearchPage,
});

type SearchMode = "sponsors" | "youtubers";

const formatMetric = (value?: number) => {
  if (!value) return "—";
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}k`;
  return value.toString();
};

const formatDate = (value?: number) => {
  if (!value) return "—";
  return new Date(value).toLocaleDateString();
};

function SearchPage() {
  const [mode, setMode] = useState<SearchMode>("sponsors");
  const [searchText, setSearchText] = useState("");
  const [favoritesOnly, setFavoritesOnly] = useState(false);

  const sponsorsQuery = useQuery(
    convexQuery(api.search.listSponsors, {
      search: searchText || undefined,
      limit: 24,
    }),
  );
  const creatorsQuery = useQuery(
    convexQuery(api.search.listCreators, {
      search: searchText || undefined,
      limit: 24,
    }),
  );

  const data = useMemo(() => {
    if (mode === "sponsors") {
      return sponsorsQuery.data ?? [];
    }
    return creatorsQuery.data ?? [];
  }, [mode, sponsorsQuery.data, creatorsQuery.data]);

  const isLoading = mode === "sponsors" ? sponsorsQuery.isLoading : creatorsQuery.isLoading;

  return (
    <div className="container mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-muted-foreground text-sm">Search</p>
          <h1 className="text-2xl font-semibold">Sponsor & Creator Discovery</h1>
        </div>
        <Tabs value={mode} onValueChange={(value) => setMode(value as SearchMode)}>
          <TabsList>
            <TabsTrigger value="sponsors">Sponsor Search</TabsTrigger>
            <TabsTrigger value="youtubers">YouTuber Search</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <Card className="h-fit">
          <CardHeader>
            <CardTitle>Filters</CardTitle>
            <CardDescription>Refine your discovery results.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid gap-2">
              <label className="text-sm font-medium" htmlFor="search">
                Search by name
              </label>
              <Input
                id="search"
                placeholder={mode === "sponsors" ? "Enter a sponsor name..." : "Enter a YouTuber name..."}
                value={searchText}
                onChange={(event) => setSearchText(event.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <span className="text-sm font-medium">Filter by category</span>
              <Select defaultValue="all">
                <SelectTrigger>
                  <SelectValue placeholder="Select a category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All categories</SelectItem>
                  <SelectItem value="tech">Tech</SelectItem>
                  <SelectItem value="gaming">Gaming</SelectItem>
                  <SelectItem value="lifestyle">Lifestyle</SelectItem>
                  <SelectItem value="education">Education</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <span className="text-sm font-medium">Minimum median views</span>
              <Input placeholder="500,000" />
            </div>
            <div className="grid gap-2">
              <span className="text-sm font-medium">Upload frequency</span>
              <Input placeholder="2 / month" />
            </div>
            <div className="grid gap-2">
              <span className="text-sm font-medium">Minimum subscribers</span>
              <Input placeholder="1M" />
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="text-sm font-medium">Favorites only</p>
                <p className="text-muted-foreground text-xs">
                  Limit results to saved partners.
                </p>
              </div>
              <Switch checked={favoritesOnly} onCheckedChange={setFavoritesOnly} />
            </div>
            <Button variant="secondary">Reset filters</Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-col gap-4 border-b sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Results</CardTitle>
              <CardDescription>
                Showing {data.length} {mode === "sponsors" ? "sponsors" : "creators"}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground text-sm">Rows per page</span>
              <Select defaultValue="10">
                <SelectTrigger className="w-[92px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="20">20</SelectItem>
                  <SelectItem value="30">30</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm">
                <Badge variant="secondary">{mode === "sponsors" ? "Sponsored" : "Creators"}</Badge>
                <Separator orientation="vertical" className="h-4" />
                <span className="text-muted-foreground">
                  {isLoading ? "Loading data from Convex..." : "Powered by Convex"}
                </span>
              </div>
              <Button variant="ghost" size="sm">
                Clear
              </Button>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[240px]">Name</TableHead>
                  <TableHead>{mode === "sponsors" ? "Website" : "Subscribers"}</TableHead>
                  <TableHead>{mode === "sponsors" ? "Last seen" : "Avg views"}</TableHead>
                  <TableHead>{mode === "sponsors" ? "First seen" : "Avg likes"}</TableHead>
                  <TableHead className="text-right">Profile</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.length === 0 && !isLoading && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-muted-foreground text-center">
                      No results yet. Try another search term.
                    </TableCell>
                  </TableRow>
                )}
                {mode === "sponsors" &&
                  (data as typeof sponsorsQuery.data)?.map((sponsor) => (
                    <TableRow key={sponsor._id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar>
                            <AvatarImage src={sponsor.logo} alt={sponsor.name} />
                            <AvatarFallback>{sponsor.name.slice(0, 2).toUpperCase()}</AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium">{sponsor.name}</p>
                            <p className="text-muted-foreground text-xs">{sponsor.website}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{sponsor.website}</TableCell>
                      <TableCell>{formatDate(sponsor.lastSeen)}</TableCell>
                      <TableCell>{formatDate(sponsor.firstSeen)}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="outline" size="sm" asChild>
                          <Link to="/sponsors/$sponsorId" params={{ sponsorId: sponsor._id }}>
                            View
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                {mode === "youtubers" &&
                  (data as typeof creatorsQuery.data)?.map((creator) => (
                    <TableRow key={creator._id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar>
                            <AvatarImage src={creator.channelPfp} alt={creator.channelName} />
                            <AvatarFallback>{creator.channelName.slice(0, 2).toUpperCase()}</AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium">{creator.channelName}</p>
                            <p className="text-muted-foreground text-xs">{creator.youtubeHandle}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{formatMetric(creator.subscribers)}</TableCell>
                      <TableCell>{formatMetric(creator.avgViews)}</TableCell>
                      <TableCell>{formatMetric(creator.avgLikes)}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="outline" size="sm" asChild>
                          <Link to="/youtubers/$youtuberId" params={{ youtuberId: creator._id }}>
                            View
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
            <Pagination>
              <PaginationContent>
                <PaginationItem>
                  <PaginationLink href="#">1</PaginationLink>
                </PaginationItem>
                <PaginationItem>
                  <PaginationLink href="#" isActive>
                    2
                  </PaginationLink>
                </PaginationItem>
                <PaginationItem>
                  <PaginationLink href="#">3</PaginationLink>
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
