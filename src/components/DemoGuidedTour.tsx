"use client";

import type { CSSProperties } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

type GuideStep = {
  title: string;
  detail: string;
  selector?: string;
  href?: string;
  actionLabel: string;
  prefillPrompt?: string;
};

type AnchorState = {
  top: number;
  left: number;
  placement: "left" | "right" | "top" | "bottom";
} | null;

type SpotlightState = {
  top: number;
  left: number;
  right: number;
  bottom: number;
} | null;

function stepsForPath(pathname: string): GuideStep[] {
  if (pathname === "/demos") {
    return [
      {
        title: "Start with the Travel case study",
        detail: "This is the strongest judge flow: Atlas → AI → policy → human authority → Solana proof.",
        href: "/demos/travel",
        actionLabel: "Open Travel demo",
      },
      {
        title: "Then show Logistics",
        detail: "Use it to prove the same authority layer also works outside travel.",
        href: "/demos/logistics",
        actionLabel: "Open Logistics",
      },
      {
        title: "Finish with Evidence",
        detail: "End the story with the real Devnet transaction, PDA and Explorer links.",
        href: "/evidence",
        actionLabel: "Open Evidence",
      },
    ];
  }

  if (pathname === "/demos/travel") {
    return [
      {
        title: "1. Describe the trip and budget",
        detail: "Type the destination, dates or trip length, preferences and budget here. The agent uses this as the whole-trip goal.",
        selector: '[data-tour="travel-trip-prompt"]',
        actionLabel: "Use ready-made trip prompt",
        prefillPrompt: "Plan Tokyo starting 2026-11-15 for 4 days. I like local food, culture and walkable neighborhoods. Budget $1,200.",
      },
      {
        title: "2. Send it to the travel agent",
        detail: "Press this button. DeepSeek interprets the request, then provider search and deterministic budget checks build the draft.",
        selector: '[data-tour="travel-send-prompt"]',
        actionLabel: "Send prompt here",
      },
      {
        title: "3. Review the AI-picked combo",
        detail: "The agent ranks a whole-trip combo against your budget first. You only need full provider lists if you want to change something.",
        selector: '[data-tour="travel-ai-combo"]',
        actionLabel: "Review AI combo here",
      },
      {
        title: "4. Change the trip with a prompt",
        detail: "Already have a draft? Type a new instruction here to move the date, replace the flight, change the hotel or ask for another combo. The old version stays in History.",
        selector: '[data-tour="travel-change-prompt"]',
        actionLabel: "Use ready-made change prompt",
        prefillPrompt: "Đổi khách sạn sang chỗ yên tĩnh hơn nhưng giữ nguyên ngân sách",
      },
      {
        title: "5. Choose email wallet or Phantom",
        detail: "Open this exact wallet control. Email OTP creates or recovers an embedded Solana wallet; Phantom remains optional.",
        selector: '[data-tour="travel-wallet-choice"]',
        actionLabel: "Choose wallet here",
      },
      {
        title: "6. Verify the final action",
        detail: "After a wallet is ready, approve only the exact final action. Planning, research and draft changes stay off-chain.",
        selector: '[data-tour="travel-final-verify-action"]',
        actionLabel: "Click final verification here",
      },
    ];
  }

  if (pathname === "/demos/logistics") {
    return [
      {
        title: "1. Read the AI proposal",
        detail: "Show the operational action first: move 250 units to prevent the HCM stockout.",
        selector: '[data-tour="logistics-proposal"]',
        actionLabel: "Show AI action",
      },
      {
        title: "2. Review the authority gate",
        detail: "The $8,000 action is valid but above the $5,000 autonomous limit.",
        selector: '[data-test="demo-next-step"]',
        actionLabel: "Show approval CTA",
      },
      {
        title: "3. Approve only this exact action",
        detail: "After opening the review sheet, the consent button binds amount, quote and nonce.",
        selector: '[data-test="approval-consent"]',
        actionLabel: "Show consent",
      },
      {
        title: "4. End with proof",
        detail: "Open Evidence to show receipt + human authority + confirmed Devnet proof.",
        selector: '[data-tour="logistics-evidence"]',
        actionLabel: "Show Evidence",
      },
    ];
  }

  return [];
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function fillTravelPrompt(value: string) {
  const target = document.querySelector<HTMLTextAreaElement>(
    '[data-tour="travel-trip-prompt"], [data-tour="travel-change-prompt"] textarea, #travel-agent-prompt',
  );
  if (!target) return false;
  const setter = Object.getOwnPropertyDescriptor(
    HTMLTextAreaElement.prototype,
    "value",
  )?.set;
  setter?.call(target, value);
  target.dispatchEvent(new Event("input", { bubbles: true }));
  target.focus({ preventScroll: true });
  return true;
}

export function DemoGuidedTour() {
  const pathname = usePathname();
  const router = useRouter();
  const steps = useMemo(() => stepsForPath(pathname), [pathname]);
  const guideRef = useRef<HTMLElement>(null);
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const [anchor, setAnchor] = useState<AnchorState>(null);
  const [spotlight, setSpotlight] = useState<SpotlightState>(null);
  const [targetMissing, setTargetMissing] = useState(false);

  const current = steps[index] ?? steps[0];

  useEffect(() => {
    if (steps.length === 0) return;
    const key = `agentic-demo-guide:${pathname}`;
    const seen = window.sessionStorage.getItem(key);
    if (!seen) {
      const timer = window.setTimeout(() => {
        setOpen(true);
        setIndex(0);
        window.sessionStorage.setItem(key, "seen");
      }, 0);
      return () => window.clearTimeout(timer);
    }
  }, [pathname, steps.length]);

  useEffect(() => {
    if (!open || !current?.prefillPrompt || pathname !== "/demos/travel") return;
    const timer = window.setTimeout(() => {
      fillTravelPrompt(current.prefillPrompt!);
    }, 100);
    return () => window.clearTimeout(timer);
  }, [current?.prefillPrompt, open, pathname]);

  useEffect(() => {
    if (!open || !current?.selector) {
      const timer = window.setTimeout(() => {
        setAnchor(null);
        setSpotlight(null);
      }, 0);
      return () => window.clearTimeout(timer);
    }

    const selector = current.selector;
    let raf = 0;
    let highlightedTarget: HTMLElement | null = null;

    const updatePosition = () => {
      window.cancelAnimationFrame(raf);
      raf = window.requestAnimationFrame(() => {
        const target = document.querySelector<HTMLElement>(selector);
        const guide = guideRef.current;
        if (!target || !guide) {
          setAnchor(null);
          setSpotlight(null);
          setTargetMissing(true);
          return;
        }

        setTargetMissing(false);
        const targetRect = target.getBoundingClientRect();
        const guideRect = guide.getBoundingClientRect();
        const spotlightPad = 5;
        setSpotlight({
          top: Math.max(0, targetRect.top - spotlightPad),
          left: Math.max(0, targetRect.left - spotlightPad),
          right: Math.min(window.innerWidth, targetRect.right + spotlightPad),
          bottom: Math.min(window.innerHeight, targetRect.bottom + spotlightPad),
        });
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        const edge = 10;
        const gap = 10;
        const guideWidth = guideRect.width || Math.min(292, viewportWidth - edge * 2);
        const guideHeight = guideRect.height || 176;

        const fitsLeft = targetRect.left - gap - guideWidth >= edge;
        const fitsRight = targetRect.right + gap + guideWidth <= viewportWidth - edge;
        const fitsBelow = targetRect.bottom + gap + guideHeight <= viewportHeight - edge;

        // Prefer the conventional coach-mark position on the left side of the
        // target. Fall back only when the viewport does not have enough room.
        if (fitsLeft) {
          setAnchor({
            placement: "left",
            left: targetRect.left - gap - guideWidth,
            top: clamp(
              targetRect.top + targetRect.height / 2 - guideHeight / 2,
              edge,
              viewportHeight - guideHeight - edge,
            ),
          });
          return;
        }

        if (fitsRight) {
          setAnchor({
            placement: "right",
            left: targetRect.right + gap,
            top: clamp(
              targetRect.top + targetRect.height / 2 - guideHeight / 2,
              edge,
              viewportHeight - guideHeight - edge,
            ),
          });
          return;
        }

        if (fitsBelow) {
          setAnchor({
            placement: "bottom",
            left: clamp(
              targetRect.left + targetRect.width / 2 - guideWidth / 2,
              edge,
              viewportWidth - guideWidth - edge,
            ),
            top: targetRect.bottom + gap,
          });
          return;
        }

        setAnchor({
          placement: "top",
          left: clamp(
            targetRect.left + targetRect.width / 2 - guideWidth / 2,
            edge,
            viewportWidth - guideWidth - edge,
          ),
          top: Math.max(edge, targetRect.top - gap - guideHeight),
        });
      });
    };

    const prepare = window.setTimeout(() => {
      const target = document.querySelector<HTMLElement>(selector);
      if (!target) {
        setAnchor(null);
        setSpotlight(null);
        setTargetMissing(true);
        return;
      }
      setTargetMissing(false);
      target.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
      highlightedTarget = target;
      target.classList.add("demo-tour-highlight");
      updatePosition();
      window.setTimeout(updatePosition, 280);
    }, 120);

    const observer = new MutationObserver(() => {
      const target = document.querySelector<HTMLElement>(selector);
      if (!target) return;
      if (highlightedTarget !== target) {
        highlightedTarget?.classList.remove("demo-tour-highlight");
        highlightedTarget = target;
        target.classList.add("demo-tour-highlight");
      }
      setTargetMissing(false);
      updatePosition();
    });
    observer.observe(document.body, { childList: true, subtree: true });

    window.addEventListener("scroll", updatePosition, { passive: true });
    window.addEventListener("resize", updatePosition);

    return () => {
      window.clearTimeout(prepare);
      window.cancelAnimationFrame(raf);
      observer.disconnect();
      highlightedTarget?.classList.remove("demo-tour-highlight");
      window.removeEventListener("scroll", updatePosition);
      window.removeEventListener("resize", updatePosition);
    };
  }, [current?.selector, open]);

  if (steps.length === 0) return null;

  function showCurrent() {
    if (current.href) {
      router.push(current.href);
      return;
    }

    if (current.prefillPrompt && pathname === "/demos/travel") {
      fillTravelPrompt(current.prefillPrompt);
    }
    if (!current.selector) return;
    const target = document.querySelector<HTMLElement>(current.selector);
    if (!target) {
      setTargetMissing(true);
      return;
    }
    setTargetMissing(false);
    target.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
    target.classList.add("demo-tour-highlight");
    window.setTimeout(() => target.classList.remove("demo-tour-highlight"), 2600);
  }

  function next() {
    if (index >= steps.length - 1) {
      setOpen(false);
      return;
    }

    setIndex((value) => value + 1);
  }

  if (!open) {
    return (
      <button
        type="button"
        className="demo-guide-launcher"
        onClick={() => {
          setIndex(0);
          setOpen(true);
        }}
      >
        <span>?</span>
        Demo guide
      </button>
    );
  }

  const guideStyle: CSSProperties | undefined = anchor
    ? {
        top: `${anchor.top}px`,
        left: `${anchor.left}px`,
        right: "auto",
        bottom: "auto",
      }
    : undefined;

  return (
    <>
      {spotlight ? (
        <div className="demo-guide-spotlight" aria-hidden="true">
          <i
            className="is-top"
            style={{ height: spotlight.top }}
          />
          <i
            className="is-left"
            style={{
              top: spotlight.top,
              width: spotlight.left,
              height: Math.max(0, spotlight.bottom - spotlight.top),
            }}
          />
          <i
            className="is-right"
            style={{
              top: spotlight.top,
              left: spotlight.right,
              right: 0,
              height: Math.max(0, spotlight.bottom - spotlight.top),
            }}
          />
          <i
            className="is-bottom"
            style={{ top: spotlight.bottom, bottom: 0 }}
          />
          <b
            className="demo-guide-spotlight-ring"
            data-label={current.actionLabel}
            style={{
              top: spotlight.top,
              left: spotlight.left,
              width: Math.max(0, spotlight.right - spotlight.left),
              height: Math.max(0, spotlight.bottom - spotlight.top),
            }}
          />
        </div>
      ) : null}
      <aside
      ref={guideRef}
      className={[
        "demo-guide",
        anchor ? "is-anchored" : "is-floating",
        anchor ? `is-${anchor.placement}` : "",
      ].join(" ")}
      style={guideStyle}
      aria-label="Demo walkthrough"
    >
      <div className="demo-guide-head">
        <div>
          <span>GUIDED DEMO</span>
          <strong>
            Step {index + 1} of {steps.length}
          </strong>
        </div>
        <button type="button" onClick={() => setOpen(false)} aria-label="Close demo guide">
          ×
        </button>
      </div>

      <div className="demo-guide-progress" aria-hidden="true">
        {steps.map((step, stepIndex) => (
          <i
            key={step.title}
            className={
              stepIndex < index
                ? "is-done"
                : stepIndex === index
                  ? "is-current"
                  : ""
            }
          />
        ))}
      </div>

      <div className="demo-guide-copy">
        <strong>{current.title}</strong>
        <p>
          {targetMissing
            ? "Complete the previous action first. This step will highlight automatically as soon as its control appears."
            : current.detail}
        </p>
      </div>

      <div className="demo-guide-actions">
        <button type="button" className="is-show" onClick={showCurrent}>
          {current.actionLabel}
        </button>
        <button type="button" className="is-next" onClick={next}>
          {index === steps.length - 1 ? "Done" : "Next →"}
        </button>
      </div>
    </aside>
    </>
  );
}
