import {
  buildDemoTravelCaseStudy,
  buildLiveTravelCaseStudy,
} from "@/scenarios/travel/case-study";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const mode = url.searchParams.get("mode") === "live" ? "live" : "demo";
  const result =
    mode === "live"
      ? await buildLiveTravelCaseStudy()
      : buildDemoTravelCaseStudy();

  return Response.json({ ok: true, caseStudy: result });
}
