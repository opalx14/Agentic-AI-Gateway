"use client";

import { usePathname } from "next/navigation";

import { DemoGuidedTour } from "./DemoGuidedTour";
import { SiteHeader } from "./SiteHeader";

export function ConditionalSiteHeader() {
  const pathname = usePathname();

  return (
    <>
      <SiteHeader />
      {pathname === "/" ? null : <DemoGuidedTour />}
    </>
  );
}
