import type { DemoScenarioState } from "./demo-model";

export type Domain = "logistics" | "travel";
export type TravelOption = "A" | "B";
type DemoCoachAction = "review" | "travel-b" | "evidence";

type DemoCoachStep = {
  label: string;
  detail: string;
  state: "done" | "current" | "locked";
};

type DemoCoachState = {
  eyebrow: string;
  title: string;
  copy: string;
  action: DemoCoachAction;
  actionLabel: string;
  steps: DemoCoachStep[];
};

export function money(amount: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function decisionClass(decision: DemoScenarioState["decision"]) {
  if (decision === "ALLOW") return "ned-decision-allow";
  if (decision === "BLOCK") return "ned-decision-block";
  return "ned-decision-escalate";
}

export function demoCoachState(input: {
  domain: Domain;
  travelOption: TravelOption;
  logisticsApproved: boolean;
  travelBApproved: boolean;
}): DemoCoachState {
  if (input.domain === "logistics") {
    if (input.logisticsApproved) {
      return {
        eyebrow: "NEXT STEP · PROVE THE RESULT",
        title: "Open the evidence trail.",
        copy:
          "The exact $8,000 transfer has executed. Now inspect the receipt and the confirmed Solana authority proof so the demo ends with evidence, not a claim.",
        action: "evidence",
        actionLabel: "Open evidence & proof",
        steps: [
          { label: "Understand incident", detail: "HCM stockout risk", state: "done" },
          { label: "Inspect AI proposal", detail: "Move 250 units", state: "done" },
          { label: "Approve exact action", detail: "$8,000 consent", state: "done" },
          { label: "Verify result", detail: "Receipt + proof", state: "current" },
        ],
      };
    }

    return {
      eyebrow: "NEXT STEP · HUMAN AUTHORITY",
      title: "Review the exact $8,000 transfer.",
      copy:
        "The proposal is operationally valid but above the $5,000 autonomous limit. Your job is to approve this exact action before the provider can execute.",
      action: "review",
      actionLabel: "Review exact $8,000 action",
      steps: [
        { label: "Understand incident", detail: "HCM stockout risk", state: "done" },
        { label: "Inspect AI proposal", detail: "Move 250 units", state: "done" },
        { label: "Approve exact action", detail: "$8,000 consent", state: "current" },
        { label: "Verify result", detail: "Receipt + proof", state: "locked" },
      ],
    };
  }

  if (input.travelOption === "A") {
    return {
      eyebrow: "NEXT STEP · COMPARE AUTHORITY",
      title: "Now try the +$45 option.",
      copy:
        "FIX-A shows autonomous recovery because +$15 is inside the delegated +$20 limit. Switch to FIX-B to see where human approval becomes mandatory.",
      action: "travel-b",
      actionLabel: "Try FIX-B · +$45",
      steps: [
        { label: "See auto path", detail: "FIX-A · +$15", state: "done" },
        { label: "Trigger human gate", detail: "FIX-B · +$45", state: "current" },
        { label: "Approve exact quote", detail: "Quote-bound consent", state: "locked" },
        { label: "Verify result", detail: "Receipt + proof", state: "locked" },
      ],
    };
  }

  if (!input.travelBApproved) {
    return {
      eyebrow: "NEXT STEP · HUMAN AUTHORITY",
      title: "Review the exact +$45 recovery.",
      copy:
        "FIX-B protects the trip but exceeds delegated spend. Review the verified quote and approve only this exact replacement.",
      action: "review",
      actionLabel: "Review exact +$45 change",
      steps: [
        { label: "See auto path", detail: "FIX-A · +$15", state: "done" },
        { label: "Trigger human gate", detail: "FIX-B · +$45", state: "done" },
        { label: "Approve exact quote", detail: "Quote-bound consent", state: "current" },
        { label: "Verify result", detail: "Receipt + proof", state: "locked" },
      ],
    };
  }

  return {
    eyebrow: "NEXT STEP · PROVE THE RESULT",
    title: "Open the evidence trail.",
    copy:
      "The +$45 replacement has executed after exact consent. Finish the demo by showing the receipt, authority evidence and confirmed Devnet proof.",
    action: "evidence",
    actionLabel: "Open evidence & proof",
    steps: [
      { label: "See auto path", detail: "FIX-A · +$15", state: "done" },
      { label: "Trigger human gate", detail: "FIX-B · +$45", state: "done" },
      { label: "Approve exact quote", detail: "Quote-bound consent", state: "done" },
      { label: "Verify result", detail: "Receipt + proof", state: "current" },
    ],
  };
}

