"use client";

import { FormEvent, KeyboardEvent, useCallback, useEffect, useState, useSyncExternalStore } from "react";

import type { WalletAuthorityState } from "@/components/PhantomWalletControl";
import { useAppLanguage } from "@/components/i18n/AppLanguageProvider";
import { readDemoSessionWallet } from "@/lib/solana/demo-session-wallet";
import { bookingTotal, createBookingRecord, hasConnectedTravelWallet, markBookingDemoComplete, markBookingVerified, readBookings, removeBookingFromWallet, selectionsCompleteForPlan, selectionsFromRecord, supersedeBooking, updateBookingSelections, upsertBooking, writeBookings, type BookingSelections, type TravelBookingRecord } from "@/scenarios/travel/booking-history";
import type { TravelCatalogOption } from "@/scenarios/travel/catalog-registry";
import type { AgenticTripPlan } from "@/scenarios/travel/agentic-types";
import { assessTravelIntake, mergeTravelIntakeAnswer, travelChangeClarification, type TravelIntakeSlot } from "@/scenarios/travel/travel-intake";

import { fetchFinalDigest, fetchTravelAgent, fetchTravelCatalog, verifyAtlasFlightChoice } from "./travel-flow-api";

import { AGENT_STORY, SEARCH_STORIES, SELECTION_HANDOFF_MS, STEP_LABELS, STEP_ORDER, bookingStage, getServerSpeechSupportSnapshot, getSpeechSupportSnapshot, nextStageForPlan, replanStage, subscribeSpeechSupport, type BookingStage, type FinalDigest, type OnchainResult, type ServiceStage, type TravelFlowSnapshot } from "./travel-flow";
import { startTravelSpeech } from "./travel-speech";

const EMPTY_WALLET: WalletAuthorityState = { provider: "phantom", status: "disconnected", address: null, signatureBytes: null };
export function useTravelAgentFlow() {
  const { language } = useAppLanguage();
  const [prompt, setPrompt] = useState("");
  const [requests, setRequests] = useState<string[]>([]);
  const [intakeContext, setIntakeContext] = useState("");
  const [clarificationQuestion, setClarificationQuestion] = useState("");
  const [missingIntakeSlots, setMissingIntakeSlots] = useState<TravelIntakeSlot[]>([]);
  const [plan, setPlan] = useState<AgenticTripPlan | null>(null);
  const [stage, setStage] = useState<BookingStage>("flight");
  const [searching, setSearching] = useState(false);
  const [searchStatus, setSearchStatus] = useState("");
  const [agentStatus, setAgentStatus] = useState("");
  const [choices, setChoices] = useState<TravelCatalogOption[]>([]);
  const [selections, setSelections] = useState<BookingSelections>({});
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [finalDigest, setFinalDigest] = useState<FinalDigest | null>(null);
  const [bookings, setBookings] = useState<TravelBookingRecord[]>([]);
  const [activeBookingId, setActiveBookingId] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [walletAuthority, setWalletAuthorityState] =
    useState<WalletAuthorityState>(EMPTY_WALLET);

  const speechSupported = useSyncExternalStore(
    subscribeSpeechSupport,
    getSpeechSupportSnapshot,
    getServerSpeechSupportSnapshot,
  );
  const walletConnected = hasConnectedTravelWallet(walletAuthority);
  const total = bookingTotal(selections);
  const activeBooking =
    bookings.find((item) => item.id === activeBookingId) ?? null;
  const activeStepIndex =
    stage === "complete"
      ? STEP_ORDER.length
      : Math.max(
          0,
          STEP_ORDER.indexOf(stage as (typeof STEP_ORDER)[number]),
        );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setBookings(readBookings(window.localStorage, walletAuthority.address));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [walletAuthority.address]);

  function commitBookings(next: TravelBookingRecord[]) {
    setBookings(next);
    writeBookings(window.localStorage, walletAuthority.address, next);
  }

  function commitRecord(record: TravelBookingRecord) {
    commitBookings(upsertBooking(bookings, record));
    setActiveBookingId(record.id);
  }

  async function playSearchStory(next: ServiceStage) {
    for (const cue of SEARCH_STORIES[next]) {
      setSearchStatus(cue.message);
      await new Promise((resolve) => window.setTimeout(resolve, cue.duration));
    }
  }

  async function playAgentStory() {
    for (const cue of AGENT_STORY) {
      setAgentStatus(cue.message);
      await new Promise((resolve) => window.setTimeout(resolve, cue.duration));
    }
  }

  async function loadStageChoices(
    activePlan: AgenticTripPlan,
    next: ServiceStage,
    selectionSnapshot: BookingSelections = selections,
  ) {
    setSearching(true);
    setSearchStatus("Opening the off-chain provider search…");
    setChoices([]);
    setError("");

    const [result] = await Promise.all([
      fetchTravelCatalog({
        plan: activePlan,
        stage: next,
        selections: selectionSnapshot,
      }),
      playSearchStory(next),
    ]);
    setChoices(result.options);
    if (result.source === "ATLAS") {
      setNotice("Atlas returned live flight offers. DeepSeek ranked only those provider results; selection is re-verified before continuing.");
    } else if (next === "flight" && result.fallbackReason) {
      setNotice("Atlas live search is unavailable, so flights are clearly using DEMO fallback. " + result.fallbackReason);
    } else if (next === "hotel" && result.options[0]?.aiRecommended) {
      setNotice(
        "AI used your trip budget and current draft spend to rank the hotel shortlist. The top room is a budget-aware recommendation; hotel availability is still DEMO.",
      );
    } else if (result.fallback) {
      setNotice("Provider demo endpoint was unavailable, so the deterministic destination catalog was used. Availability is still not live.");
    }
    setSearching(false);
    setSearchStatus("");
  }

  async function recommendDraftSelections(
    activePlan: AgenticTripPlan,
    options?: {
      avoidSelections?: BookingSelections;
      changeStage?: ServiceStage;
      preserveSelections?: BookingSelections;
    },
  ): Promise<BookingSelections | null> {
    setBusy(true);
    setSearching(true);
    setSearchStatus("AI is composing the best requested-service combo for your budget…");
    setChoices([]);
    setError("");

    try {
      const required = activePlan.intent.requestedServices;
      const preferredCombo =
        activePlan.recommendedCombos?.find((combo) => combo.budgetFit) ??
        activePlan.recommendedCombos?.[0];
      const recommended: BookingSelections = {};

      if (required.includes("FLIGHT")) {
        const flightResult = await fetchTravelCatalog({
          plan: activePlan,
          stage: "flight",
          selections: recommended,
        });
        const flightChoices =
          options?.changeStage === "flight" && options.avoidSelections?.flight
            ? flightResult.options.filter(
                (option) => option.id !== options.avoidSelections?.flight?.id,
              )
            : flightResult.options;
        const usableFlights = flightChoices.length > 0 ? flightChoices : flightResult.options;
        let flight =
          usableFlights.find(
            (option) => option.id === preferredCombo?.flightProviderRef,
          ) ??
          (preferredCombo
            ? usableFlights
                .slice()
                .sort(
                  (a, b) =>
                    Math.abs(a.amount - preferredCombo.flightAmountUsd) -
                    Math.abs(b.amount - preferredCombo.flightAmountUsd),
                )[0]
            : usableFlights[0]);
        if (!flight) return null;

        if (flight.source === "ATLAS") {
          const verified = await verifyAtlasFlightChoice({
            plan: activePlan,
            option: flight,
          });
          flight = verified.option;
        }
        recommended.flight = flight;
      }

      if (required.includes("STAY")) {
        const preservedHotel = options?.preserveSelections?.hotel;
        if (preservedHotel) {
          recommended.hotel = preservedHotel;
        } else {
          const hotelResult = await fetchTravelCatalog({
            plan: activePlan,
            stage: "hotel",
            selections: recommended,
          });
          const hotelChoices =
            options?.changeStage === "hotel" && options.avoidSelections?.hotel
              ? hotelResult.options.filter(
                  (option) => option.id !== options.avoidSelections?.hotel?.id,
                )
              : hotelResult.options;
          const usableHotels = hotelChoices.length > 0 ? hotelChoices : hotelResult.options;
          const hotel =
            usableHotels.find(
              (option) =>
                preferredCombo &&
                (option.title === preferredCombo.hotelTitle ||
                  option.id === "hotel-" + preferredCombo.hotelTier),
            ) ??
            usableHotels.find(
              (option) => option.aiRecommended && option.budgetFit,
            ) ??
            usableHotels.find((option) => option.budgetFit) ??
            usableHotels[0];
          if (!hotel) return null;
          recommended.hotel = hotel;
        }
      }

      if (required.includes("TRANSFER")) {
        const transferResult = await fetchTravelCatalog({
          plan: activePlan,
          stage: "transfer",
          selections: recommended,
        });
        const transferChoices =
          options?.changeStage === "transfer" && options.avoidSelections?.transfer
            ? transferResult.options.filter(
                (option) => option.id !== options.avoidSelections?.transfer?.id,
              )
            : transferResult.options;
        const usableTransfers = transferChoices.length > 0 ? transferChoices : transferResult.options;
        const transfer = preferredCombo
          ? usableTransfers
              .slice()
              .sort(
                (a, b) =>
                  Math.abs(a.amount - preferredCombo.transferAmountUsd) -
                  Math.abs(b.amount - preferredCombo.transferAmountUsd),
              )[0]
          : usableTransfers[0];
        if (!transfer) return null;
        recommended.transfer = transfer;
      }

      if (!selectionsCompleteForPlan(activePlan, recommended)) {
        return null;
      }

      const activities = required.includes("ACTIVITY")
        ? activePlan.nodes
            .filter((node) => node.kind === "ACTIVITY")
            .reduce((sum, node) => sum + (node.amountUsd ?? 0), 0)
        : 0;
      const projectedTotal = bookingTotal(recommended) + activities;

      if (projectedTotal > activePlan.intent.budgetUsd) {
        setNotice(
          `No requested-service combo fits the $${activePlan.intent.budgetUsd} budget yet. ` +
            "The closest provider options are available to review instead of silently exceeding it.",
        );
        return null;
      }

      return recommended;
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "AI could not compose a complete provider combo.",
      );
      return null;
    } finally {
      setBusy(false);
      setSearching(false);
      setSearchStatus("");
    }
  }

  function openStage(
    next: BookingStage,
    activePlan = plan,
    selectionSnapshot: BookingSelections = selections,
  ) {
    setFinalDigest(null);
    setStage(next);
    if (
      activePlan &&
      (next === "flight" || next === "hotel" || next === "transfer")
    ) {
      void loadStageChoices(activePlan, next, selectionSnapshot);
      return;
    }
    setChoices([]);
    setSearching(false);
  }

  async function callAgent(body: unknown) {
    setBusy(true);
    setAgentStatus("Reading your message…");
    setError("");
    try {
      const [data] = await Promise.all([fetchTravelAgent(body), playAgentStory()]);
      setPlan(data);
      setPrompt("");
      return data;
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Travel agent request failed.",
      );
      return null;
    } finally {
      setBusy(false);
      setAgentStatus("");
    }
  }

  async function applyPlanChange(submitted: string) {
    if (!plan || busy || submitted.trim().length < 2) return;

    const clarification = travelChangeClarification(submitted, language);
    if (clarification) {
      setRequests((items) => [...items, submitted]);
      setIntakeContext(submitted);
      setClarificationQuestion(clarification);
      setPrompt("");
      return;
    }

    setClarificationQuestion("");
    const displayRequest = submitted.includes("\n")
      ? (submitted.split("\n").at(-1) ?? submitted)
      : submitted;

    const previous =
      activeBooking ??
      createBookingRecord({
        plan,
        prompt: requests.at(-1) ?? plan.prompt,
        origin: plan.intent.origin,
        walletAddress: walletAuthority.address,
        walletProvider: walletAuthority.address ? walletAuthority.provider : null,
        selections,
      });
    const revised = await callAgent({
      action: "modify",
      prompt: submitted,
      currentPlan: plan,
    });
    if (!revised) return;

    const oldRecord = supersedeBooking(previous);
    const changeStage = replanStage(revised);
    const serviceChangeStage =
      changeStage === "flight" || changeStage === "hotel" || changeStage === "transfer"
        ? changeStage
        : undefined;
    const preserveHotel =
      serviceChangeStage === "flight" &&
      /(?:keep|giữ nguyên|giu nguyen)[^\n]*(?:hotel|khách sạn|khach san)|(?:hotel|khách sạn|khach san)[^\n]*(?:keep|giữ nguyên|giu nguyen)/i.test(
        submitted,
      );
    const recommended = await recommendDraftSelections(revised, {
      avoidSelections: selections,
      changeStage: serviceChangeStage,
      preserveSelections: preserveHotel
        ? { hotel: previous.selectedHotel }
        : undefined,
    });

    if (recommended) {
      const nextRecord = createBookingRecord({
        plan: revised,
        prompt: submitted,
        origin: revised.intent.origin,
        walletAddress: walletAuthority.address,
        walletProvider: walletAuthority.address ? walletAuthority.provider : null,
        selections: recommended,
        previousVersionId: oldRecord.id,
        createdAt: previous.createdAt,
      });
      commitBookings(upsertBooking(upsertBooking(bookings, oldRecord), nextRecord));
      setActiveBookingId(nextRecord.id);
      setSelections(recommended);
      setRequests((items) => [...items, displayRequest]);
      setChoices([]);
      setStage("final");
      setNotice(
        `AI applied your request and rebuilt a complete combo inside the $${revised.intent.budgetUsd} trip budget. ` +
          `Selected services total $${bookingTotal(recommended)}; the previous version remains in History.`,
      );
      void prepareFinalDigest(recommended, revised, walletAuthority.address);
      return;
    }

    const scheduleChanged = revised.intent.startDate !== plan.intent.startDate;
    if (scheduleChanged) {
      const nextRecord = createBookingRecord({
        plan: revised,
        prompt: submitted,
        origin: revised.intent.origin,
        walletAddress: walletAuthority.address,
        walletProvider: walletAuthority.address ? walletAuthority.provider : null,
        selections: {},
        previousVersionId: oldRecord.id,
        createdAt: previous.createdAt,
      });
      commitBookings(upsertBooking(upsertBooking(bookings, oldRecord), nextRecord));
      setActiveBookingId(nextRecord.id);
      setSelections({});
      setRequests((items) => [...items, displayRequest]);
      const next = bookingStage(nextRecord);
      setNotice(
        `Trip moved to ${revised.intent.startDate}, but AI could not safely compose a complete combo inside the current budget. ` +
          "The closest options are reopened only as a fallback.",
      );
      openStage(next, revised, {});
      return;
    }
    let carried: BookingSelections = {};
    let needsReview: Array<"hotel" | "transfer"> = [];

    if (changeStage === "flight") {
      carried = {
        hotel: previous.selectedHotel,
        transfer: previous.selectedTransfer,
      };
      needsReview = [
        ...(previous.selectedHotel ? (["hotel"] as const) : []),
        ...(previous.selectedTransfer ? (["transfer"] as const) : []),
      ];
    } else if (changeStage === "hotel") {
      carried = {
        flight: previous.selectedFlight,
        transfer: previous.selectedTransfer,
      };
      needsReview = previous.selectedTransfer ? ["transfer"] : [];
    } else if (changeStage === "transfer") {
      carried = {
        flight: previous.selectedFlight,
        hotel: previous.selectedHotel,
      };
    } else {
      carried = {
        flight: previous.selectedFlight,
        hotel: previous.selectedHotel,
        transfer: previous.selectedTransfer,
      };
    }

    const nextRecord = createBookingRecord({
      plan: revised,
      prompt: submitted,
      origin: revised.intent.origin,
      walletAddress: walletAuthority.address,
      walletProvider: walletAuthority.address ? walletAuthority.provider : null,
      selections: carried,
      previousVersionId: oldRecord.id,
      needsReview,
      createdAt: previous.createdAt,
    });
    commitBookings(upsertBooking(upsertBooking(bookings, oldRecord), nextRecord));
    setActiveBookingId(nextRecord.id);
    setSelections(carried);
    setRequests((items) => [...items, displayRequest]);
    setNotice(
      revised.consequence.summary +
        " The previous version stays in History and affected services reopen for review.",
    );
    openStage(changeStage, revised, carried);
    if (changeStage === "final") {
      void prepareFinalDigest(carried, revised, walletAuthority.address);
    }
  }

  async function submitPrompt(event?: FormEvent) {
    event?.preventDefault();
    const submitted = prompt.trim();
    if (busy || submitted.length < 2) return;

    if (!plan) {
      const combined = mergeTravelIntakeAnswer({
        current: intakeContext,
        answer: submitted,
        missing: missingIntakeSlots,
      });
      const assessment = assessTravelIntake(combined, language);
      setRequests((items) => [...items, submitted]);
      setPrompt("");

      if (!assessment.complete) {
        setIntakeContext(combined);
        setMissingIntakeSlots(assessment.missing);
        setClarificationQuestion(assessment.question);
        setNotice("");
        return;
      }

      setClarificationQuestion("");
      setMissingIntakeSlots([]);
      const created = await callAgent({
        action: "plan",
        prompt: combined,
        planner: "deepseek",
        mode: "live-preferred",
      });
      if (!created) return;
      const recommended = await recommendDraftSelections(created);
      const record = createBookingRecord({
        plan: created,
        prompt: combined,
        origin: created.intent.origin,
        walletAddress: walletAuthority.address,
        walletProvider: walletAuthority.address ? walletAuthority.provider : null,
        selections: recommended ?? {},
      });
      commitRecord(record);
      setIntakeContext("");
      setSelections(recommended ?? {});

      if (recommended) {
        setChoices([]);
        setStage("final");
        setNotice(
          `AI drafted a budget-fit combo at $${bookingTotal(recommended)} from the ranked provider options. ` +
            "Review it now; use Change only if you want more choices. Nothing is on-chain yet.",
        );
        void prepareFinalDigest(recommended, created, walletAuthority.address);
      } else {
        const next = bookingStage(record);
        setNotice(
          `AI could not safely auto-select a complete combo inside the $${created.intent.budgetUsd} budget. ` +
            "Review the closest requested-service options or change the budget in chat.",
        );
        openStage(next, created);
      }
      return;
    }

    const changeRequest = intakeContext
      ? intakeContext + "\n" + submitted
      : submitted;
    setIntakeContext("");
    setClarificationQuestion("");
    await applyPlanChange(changeRequest);
  }

  async function simulateFlightDelay() {
    await applyPlanChange("My flight is delayed 6 hours.");
  }
  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void submitPrompt();
    }
  }
  function startSpeech() {
    startTravelSpeech(setPrompt);
  }

  const prepareFinalDigest = useCallback(
    async (
      nextSelections: BookingSelections,
      planOverride: AgenticTripPlan | null,
      walletAddress: string | null,
    ) => {
      if (!planOverride || !walletAddress) return;
      if (!selectionsCompleteForPlan(planOverride, nextSelections)) return;

      setBusy(true);
      setError("");
      try {
        setFinalDigest(
          await fetchFinalDigest({
            plan: planOverride,
            wallet: walletAddress,
            selections: nextSelections,
          }),
        );
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Final digest failed.");
      } finally {
        setBusy(false);
      }
    },
    [],
  );

  const handleWalletAuthorityChange = useCallback(
    (next: WalletAuthorityState) => {
      if (
        next.provider === walletAuthority.provider &&
        next.status === walletAuthority.status &&
        next.address === walletAuthority.address &&
        next.signatureBytes === walletAuthority.signatureBytes
      ) {
        return;
      }

      const previousAddress = walletAuthority.address;
      const currentDraft =
        activeBooking ??
        (plan && stage !== "complete"
          ? createBookingRecord({
              plan,
              prompt: requests.at(-1) ?? plan.prompt,
              origin: plan.intent.origin,
              walletAddress: previousAddress,
              walletProvider: previousAddress ? walletAuthority.provider : null,
              selections,
            })
          : null);
      setWalletAuthorityState(next);

      const draftFamily =
        currentDraft && currentDraft.verificationStatus !== "VERIFIED"
          ? (() => {
              const matching = bookings.filter(
                (record) =>
                  record.tripId === currentDraft.tripId &&
                  record.verificationStatus !== "VERIFIED" &&
                  record.walletAddress === previousAddress,
              );
              return matching.some((record) => record.id === currentDraft.id)
                ? matching
                : [currentDraft, ...matching];
            })()
          : [];

      if (!next.address) {
        if (currentDraft && currentDraft.verificationStatus !== "VERIFIED") {
          if (previousAddress) {
            draftFamily.forEach((record) =>
              removeBookingFromWallet(
                window.localStorage,
                previousAddress,
                record.id,
              ),
            );
          }
          const sessionFamily = draftFamily.map<TravelBookingRecord>((record) => ({
            ...record,
            walletAddress: null,
            walletProvider: null,
            updatedAt: new Date().toISOString(),
          }));
          setBookings(sessionFamily);
          setActiveBookingId(currentDraft.id);
        } else {
          setBookings([]);
          setActiveBookingId(null);
          if (activeBooking?.verificationStatus === "VERIFIED") {
            setPlan(null);
            setSelections({});
            setRequests([]);
            setStage("flight");
            setNotice("");
            setClarificationQuestion("");
          }
        }
        setFinalDigest(null);
        return;
      }

      const scoped = readBookings(window.localStorage, next.address);
      if (currentDraft && currentDraft.verificationStatus !== "VERIFIED") {
        if (previousAddress && previousAddress !== next.address) {
          draftFamily.forEach((record) =>
            removeBookingFromWallet(
              window.localStorage,
              previousAddress,
              record.id,
            ),
          );
        }
        const reboundFamily = draftFamily.map<TravelBookingRecord>((record) => ({
          ...record,
          walletAddress: next.address,
          walletProvider: next.provider,
          updatedAt: new Date().toISOString(),
        }));
        const reboundScoped = reboundFamily.reduce(
          (records, record) => upsertBooking(records, record),
          scoped,
        );
        writeBookings(window.localStorage, next.address, reboundScoped);
        setBookings(reboundScoped);
        setActiveBookingId(currentDraft.id);
      } else {
        setBookings(scoped);
        setActiveBookingId(null);
        if (
          activeBooking?.verificationStatus === "VERIFIED" &&
          previousAddress &&
          previousAddress !== next.address
        ) {
          setPlan(null);
          setSelections({});
          setRequests([]);
          setStage("flight");
          setNotice("");
          setClarificationQuestion("");
          setFinalDigest(null);
        }
      }

      if (stage === "final" && currentDraft?.verificationStatus !== "VERIFIED") {
        void prepareFinalDigest(selections, plan, next.address);
      }
    },
    [
      activeBooking,
      bookings,
      plan,
      prepareFinalDigest,
      requests,
      selections,
      stage,
      walletAuthority.address,
      walletAuthority.provider,
      walletAuthority.signatureBytes,
      walletAuthority.status,
    ],
  );

  useEffect(() => {
    const provider = window.phantom?.solana ?? window.solana ?? null;

    const applyDemoFallback = () => {
      const demoWallet = readDemoSessionWallet();
      if (demoWallet) {
        handleWalletAuthorityChange({
          provider: "demo",
          status: "connected",
          address: demoWallet.publicKey.toBase58(),
          signatureBytes: null,
        });
        return;
      }

      handleWalletAuthorityChange({
        provider: "phantom",
        status: provider ? "disconnected" : "missing",
        address: null,
        signatureBytes: null,
      });
    };

    const applyPhantom = (publicKey?: { toString(): string } | null) => {
      const key = publicKey ?? provider?.publicKey ?? null;
      if (!key) {
        applyDemoFallback();
        return;
      }

      handleWalletAuthorityChange({
        provider: "phantom",
        status: "connected",
        address: key.toString(),
        signatureBytes: null,
      });
    };

    const timer = window.setTimeout(() => {
      if (provider?.publicKey) {
        applyPhantom(provider.publicKey);
      } else {
        applyDemoFallback();
      }
    }, 0);

    provider?.on?.("connect", applyPhantom);
    provider?.on?.("accountChanged", applyPhantom);
    provider?.on?.("disconnect", applyDemoFallback);

    return () => {
      window.clearTimeout(timer);
      provider?.off?.("connect", applyPhantom);
      provider?.off?.("accountChanged", applyPhantom);
      provider?.off?.("disconnect", applyDemoFallback);
    };
  }, [handleWalletAuthorityChange]);

  async function choose(actionStage: ServiceStage, option: TravelCatalogOption) {
    if (!plan || busy) return;
    setBusy(true);
    setError("");
    let selectedOption = option;
    if (actionStage === "flight" && option.source === "ATLAS") {
      try {
        const verified = await verifyAtlasFlightChoice({ plan, option });
        selectedOption = verified.option;
        if (verified.changed) {
          setChoices((items) => items.map((item) => item.id === option.id ? verified.option : item));
          setNotice("Atlas quote changed. Review the updated total before selecting again.");
          setBusy(false);
          return;
        }
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Atlas offer verification failed.");
        setBusy(false);
        return;
      }
    }
    setNotice(selectedOption.title + " selected. AI is checking downstream timing off-chain…");
    const nextSelections: BookingSelections = {
      ...selections,
      [actionStage]: selectedOption,
    };
    const needsReview = (activeBooking?.needsReview ?? []).filter(
      (item) => item !== actionStage,
    );
    const baseRecord =
      activeBooking ??
      createBookingRecord({
        plan,
        prompt: requests.at(-1) ?? plan.prompt,
        origin: plan.intent.origin,
        walletAddress: walletAuthority.address,
        walletProvider: walletAuthority.address ? walletAuthority.provider : null,
        selections,
      });
    commitRecord(
      updateBookingSelections(
        {
          ...baseRecord,
          walletAddress: walletAuthority.address,
          walletProvider: walletAuthority.address ? walletAuthority.provider : null,
        },
        nextSelections,
        needsReview,
      ),
    );
    setSelections(nextSelections);
    await new Promise((resolve) =>
      window.setTimeout(resolve, SELECTION_HANDOFF_MS),
    );
    setNotice(selectedOption.title + " added to the local draft. No chain write.");
    const next = nextStageForPlan(plan, actionStage);
    setStage(next);
    setBusy(false);
    if (next === "final") {
      setChoices([]);
      void prepareFinalDigest(nextSelections, plan, walletAuthority.address);
    } else {
      void loadStageChoices(plan, next, nextSelections);
    }
  }

  function declineChoice(option: TravelCatalogOption) {
    if (busy) return;
    setChoices((items) => items.filter((item) => item.id !== option.id));
    setNotice(option.title + " declined. Nothing was booked or written on-chain.");
  }

  function searchStageAgain(actionStage: ServiceStage) {
    if (!plan || busy) return;
    void loadStageChoices(plan, actionStage);
  }

  function editFrom(actionStage: ServiceStage) {
    if (!plan || !activeBooking) return;
    let nextSelections: BookingSelections = { ...selections };
    let needsReview = [...activeBooking.needsReview];
    if (actionStage === "flight") {
      nextSelections = { hotel: selections.hotel, transfer: selections.transfer };
      needsReview = [
        ...(selections.hotel ? (["hotel"] as const) : []),
        ...(selections.transfer ? (["transfer"] as const) : []),
      ];
    } else if (actionStage === "hotel") {
      nextSelections = {
        flight: selections.flight,
        transfer: selections.transfer,
      };
      needsReview = selections.transfer ? ["transfer"] : [];
    } else {
      nextSelections = { flight: selections.flight, hotel: selections.hotel };
    }
    commitRecord(
      updateBookingSelections(activeBooking, nextSelections, needsReview),
    );
    setSelections(nextSelections);
    setNotice(
      STEP_LABELS[actionStage] +
        " reopened. Downstream items remain auditable and are rechecked where needed.",
    );
    openStage(actionStage, plan, nextSelections);
  }

  function loadBooking(record: TravelBookingRecord) {
    setPlan(record.plan);
    setActiveBookingId(record.id);
    const restoredSelections = selectionsFromRecord(record);
    setSelections(restoredSelections);
    setRequests([record.prompt]);
    setNotice("Loaded " + record.title + " v" + record.version + " from History.");
    setFinalDigest(
      record.finalActionDigest && record.total
        ? {
            actionHashHex: record.finalActionDigest,
            payloadDigestHex: record.finalActionDigest,
            total: record.total,
          }
        : null,
    );
    const next = bookingStage(record);
    setStage(next);
    setHistoryOpen(false);
    if (next === "flight" || next === "hotel" || next === "transfer") {
      void loadStageChoices(record.plan, next, restoredSelections);
    } else if (next === "final" && !record.finalActionDigest) {
      void prepareFinalDigest(restoredSelections, record.plan, walletAuthority.address);
    }
  }

  function onFinalConfirmed(result: OnchainResult) {
    if (!activeBooking || !finalDigest) return;
    commitRecord(
      markBookingVerified(activeBooking, {
        digest: finalDigest.actionHashHex,
        tx: result.transactionSignature,
        explorerUrl: result.explorerUrl,
        slot: result.slot,
        policyPda: result.policyPda,
        approvalPda: result.approvalPda,
        authorizationPda: result.authorizationPda,
        nonce: result.nonce,
        policyState: result.policyState,
      }),
    );
    setNotice("Final AI action verified on-chain. Draft steps stayed off-chain.");
    setStage("complete");
  }

  function onDemoComplete() {
    if (!activeBooking || !finalDigest) return;
    commitRecord(
      markBookingDemoComplete(
        activeBooking,
        finalDigest.actionHashHex,
      ),
    );
    setNotice("Demo completed locally. No Solana transaction or PDA was created.");
    setStage("complete");
  }

  const snapshot: TravelFlowSnapshot = {
    prompt,
    requests,
    clarificationQuestion,
    plan,
    stage,
    searching,
    searchStatus,
    agentStatus,
    choices,
    selections,
    notice,
    busy,
    error,
    finalDigest,
    bookings,
    activeBooking,
    historyOpen,
    walletAuthority,
    walletConnected,
    speechSupported,
    total,
    activeStepIndex,
  };

  return {
    ...snapshot,
    setPrompt,
    setWalletAuthority: handleWalletAuthorityChange,
    setHistoryOpen,
    submitPrompt,
    handleKeyDown,
    startSpeech,
    choose,
    declineChoice,
    searchStageAgain,
    editFrom,
    requestPlanChange: applyPlanChange,
    simulateFlightDelay,
    loadBooking,
    onFinalConfirmed,
    onDemoComplete,
  };
}

export type TravelAgentFlowController = ReturnType<typeof useTravelAgentFlow>;
