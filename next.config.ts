import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * The original bulk import shipped a parallel set of pages that ran entirely
   * on hardcoded SAMPLE_REQUESTS / SAMPLE_USERS / SAMPLE_SOCIAL_METRICS. They
   * were never linked from the sidebar, but they stayed reachable by URL and
   * rendered invented performance figures against real colleagues' names —
   * worse than a dead page, because they looked convincing.
   *
   * The pages are gone; these keep any existing bookmark or pasted link
   * landing on the real equivalent instead of a 404.
   */
  async redirects() {
    return [
      { source: '/performance/my', destination: '/design-ops/my-tasks', permanent: true },
      { source: '/performance/team', destination: '/design-ops/reports', permanent: true },
      { source: '/performance/change-requests', destination: '/design-ops/requests', permanent: true },
      { source: '/performance', destination: '/overview', permanent: true },
      { source: '/social/dashboard', destination: '/performance-data/social', permanent: true },
      { source: '/social/upload', destination: '/performance-data/upload', permanent: true },
    ];
  },
};

export default nextConfig;
