import type {
  DemoGraphNode,
  DemoPolicyCheck,
} from "./demo-model";

export function logisticsChecks(approved: boolean): DemoPolicyCheck[] {
  return [
    { label: "Delegated agent", state: "pass", detail: "WarehouseRebalancer" },
    { label: "Action type", state: "pass", detail: "inventory.transfer" },
    { label: "Quantity", state: "pass", detail: "250 / 300 max" },
    {
      label: "Receiving capacity",
      state: "pass",
      detail: "within 90% limit",
    },
    {
      label: "Automatic value limit",
      state: "escalate",
      detail: approved
        ? "$8,000 > $5,000 auto · exact approval satisfied"
        : "$8,000 action · $5,000 auto threshold",
    },
  ];
}

export function logisticsGraphFor(input: {
  executed: boolean;
  blocked?: boolean;
  providerFailed?: boolean;
}): DemoGraphNode[] {
  if (input.executed) {
    return [
      {
        id: "inbound",
        eyebrow: "Inbound shipment",
        title: "Delayed 12h",
        meta: "Incident still exists",
        tone: "watch",
      },
      {
        id: "inventory",
        eyebrow: "HCM inventory",
        title: "300 units",
        meta: "Recovered by rebalancing",
        tone: "healthy",
      },
      {
        id: "fulfillment",
        eyebrow: "Fulfillment",
        title: "Stockout prevented",
        meta: "250 units transferred",
        tone: "healthy",
      },
      {
        id: "sla",
        eyebrow: "Customer SLA",
        title: "6h preserved",
        meta: "Recovery completed",
        tone: "healthy",
      },
    ];
  }

  return [
    {
      id: "inbound",
      eyebrow: "Inbound shipment",
      title: "Delayed 12h",
      meta: "Expected after SLA window",
      tone: "failed",
    },
    {
      id: "inventory",
      eyebrow: "HCM inventory",
      title: "50 units left",
      meta: input.providerFailed
        ? "Authorized recovery failed at provider"
        : "200 units needed before inbound",
      tone: "watch",
      focal: true,
    },
    {
      id: "fulfillment",
      eyebrow: "Fulfillment",
      title: input.blocked
        ? "Protected by policy"
        : input.providerFailed
          ? "Recovery not applied"
          : "Stockout projected",
      meta: input.blocked
        ? "Invalid transfer never reached WMS"
        : input.providerFailed
          ? "Provider returned failure"
          : "Without rebalancing",
      tone: input.blocked ? "neutral" : "failed",
    },
    {
      id: "sla",
      eyebrow: "Customer SLA",
      title: "6h commitment",
      meta: "At risk",
      tone: "failed",
    },
  ];
}

export function travelGraphFor(input: {
  executed: boolean;
  arrivalAt: string;
  priceChanged?: boolean;
}): DemoGraphNode[] {
  const arrivalTime = new Date(input.arrivalAt).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Singapore",
  });

  if (input.executed) {
    return [
      {
        id: "flight",
        eyebrow: "Original flight",
        title: "Delayed 6h",
        meta: "Disruption observed",
        tone: "watch",
      },
      {
        id: "arrival",
        eyebrow: "Replacement arrival",
        title: arrivalTime,
        meta: "Before 17:00 deadline",
        tone: "healthy",
      },
      {
        id: "conference",
        eyebrow: "Conference",
        title: "Goal preserved",
        meta: "Recovery executed",
        tone: "healthy",
      },
    ];
  }

  return [
    {
      id: "flight",
      eyebrow: "Original flight",
      title: "Delayed 6h",
      meta: "SGN → SIN",
      tone: "failed",
    },
    {
      id: "arrival",
      eyebrow: input.priceChanged ? "Verified quote" : "Arrival goal",
      title: input.priceChanged ? "Price changed" : "Before 17:00",
      meta: input.priceChanged
        ? "New consent required"
        : "Recovery breakpoint",
      tone: "watch",
      focal: true,
    },
    {
      id: "conference",
      eyebrow: "Conference",
      title: "Attendance at risk",
      meta: "Goal depends on recovery",
      tone: "failed",
    },
  ];
}
