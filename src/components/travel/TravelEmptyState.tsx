"use client";

import { useEffect, useRef, useState } from "react";

import { useAppLanguage } from "@/components/i18n/AppLanguageProvider";
import { TravelComposer } from "./TravelComposer";
import type { TravelAgentFlowController } from "./useTravelAgentFlow";

export function TravelEmptyState({
  flow,
}: {
  flow: TravelAgentFlowController;
}) {
  const { language } = useAppLanguage();
  const hasConversation = flow.requests.length > 0 || !!flow.clarificationQuestion;
  const bottomRef = useRef<HTMLDivElement>(null);
  const stickToBottomRef = useRef(true);
  const [showScrollButton, setShowScrollButton] = useState(false);

  const demoPrompts =
    language === "vi"
      ? [
          {
            label: "Tokyo · 4 ngày",
            prompt:
              "Lên kế hoạch cho tôi chuyến Tokyo 4 ngày bắt đầu 2026-11-07. Tôi thích đồ ăn địa phương, văn hóa và khu vực dễ đi bộ. Ngân sách $1,200.",
          },
          {
            label: "Singapore · sự kiện creator",
            prompt:
              "Lên kế hoạch Singapore 3 ngày bắt đầu 2026-11-07 quanh một sự kiện creator. Ngân sách $900.",
          },
          {
            label: "Bali · nghỉ yên tĩnh",
            prompt:
              "Lên kế hoạch Bali 5 ngày bắt đầu 2026-11-07 với khách sạn yên tĩnh và đồ ăn địa phương. Ngân sách $1,000.",
          },
        ]
      : [
          {
            label: "Tokyo · 4 days",
            prompt:
              "Plan me a 4-day Tokyo trip starting 2026-11-07. I like local food, culture and walkable neighborhoods. Budget $1,200.",
          },
          {
            label: "Singapore · creator event",
            prompt:
              "Plan Singapore for 3 days starting 2026-11-07 around a creator event. Budget $900.",
          },
          {
            label: "Bali · quiet stay",
            prompt:
              "Plan Bali for 5 days starting 2026-11-07 with a quiet hotel and local food. Budget $1,000.",
          },
        ];

  useEffect(() => {
    if (!hasConversation) return;

    const updateScrollState = () => {
      const distance =
        document.documentElement.scrollHeight -
        window.innerHeight -
        window.scrollY;
      const nearBottom = distance < 160;
      stickToBottomRef.current = nearBottom;
      setShowScrollButton(!nearBottom);
    };

    updateScrollState();
    window.addEventListener("scroll", updateScrollState, { passive: true });
    window.visualViewport?.addEventListener("resize", updateScrollState);

    return () => {
      window.removeEventListener("scroll", updateScrollState);
      window.visualViewport?.removeEventListener("resize", updateScrollState);
    };
  }, [hasConversation]);

  useEffect(() => {
    if (!hasConversation || !stickToBottomRef.current) return;
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [
    flow.requests.length,
    flow.clarificationQuestion,
    flow.busy,
    flow.agentStatus,
    flow.error,
    hasConversation,
  ]);

  const workingCopy =
    flow.agentStatus ||
    (language === "vi"
      ? "AI đang xử lý chuyến đi của bạn…"
      : "AI is working on your trip…");

  return (
    <section
      className={
        "travel-chat-welcome is-compact " +
        (hasConversation ? "is-intake-conversation" : "is-empty-entry")
      }
    >
      <div className="travel-welcome-tools">
        <button
          type="button"
          className="travel-history-trigger"
          onClick={() => flow.setHistoryOpen(true)}
          disabled={!flow.walletConnected}
          title={
            flow.walletConnected
              ? language === "vi"
                ? "Mở lịch sử của ví đang kết nối"
                : "Open history for the connected wallet"
              : language === "vi"
                ? "Kết nối ví ở bước xác minh cuối để xem lịch sử đã lưu"
                : "Connect a wallet at final verification to view permanent history"
          }
        >
          {language === "vi" ? "Chuyến đi" : "Trips"}{" "}
          <span>{flow.walletConnected ? flow.bookings.length : 0}</span>
        </button>
      </div>

      {!hasConversation ? (
        <>
          <div className="travel-empty-intro">
            <h1>
              {language === "vi" ? "Bạn muốn đi đâu?" : "Where do you want to go?"}
            </h1>
            <p>
              {language === "vi"
                ? "Hãy nói cho AI những gì bạn đã biết. Nếu thiếu thông tin quan trọng, AI sẽ hỏi trước khi tìm kiếm."
                : "Tell the agent what you know. If something essential is missing, it will ask before searching."}
            </p>
          </div>

          <TravelComposer flow={flow} docked={false} />

          <div className="travel-chat-suggestions" aria-label="Demo trip prompts">
            {demoPrompts.map((item) => (
              <button
                type="button"
                key={item.label}
                onClick={() => flow.setPrompt(item.prompt)}
              >
                <span>{language === "vi" ? "MẪU" : "DEMO"}</span>
                {item.label}
              </button>
            ))}
          </div>
        </>
      ) : (
        <>
          <div className="travel-intake-thread" data-test="travel-intake-thread">
            {flow.requests.map((request, index) => (
              <div className="travel-intake-user" key={index + request}>
                <span>{language === "vi" ? "Bạn" : "You"}</span>
                <p>{request}</p>
              </div>
            ))}
            {flow.clarificationQuestion ? (
              <div
                className="travel-intake-agent"
                data-test="travel-clarification-question"
              >
                <span>AI agent</span>
                <p>{flow.clarificationQuestion}</p>
              </div>
            ) : null}
            {flow.busy ? (
              <div className="travel-loading travel-loading-agent">
                <span className="travel-loading-dot" />
                <strong>{workingCopy}</strong>
              </div>
            ) : null}
            {flow.error ? <div className="travel-error">{flow.error}</div> : null}
            <div ref={bottomRef} className="travel-thread-bottom-sentinel" />
          </div>

          {showScrollButton ? (
            <button
              type="button"
              className="travel-scroll-bottom"
              aria-label={
                language === "vi" ? "Cuộn tới tin nhắn mới nhất" : "Scroll to latest message"
              }
              onClick={() => {
                stickToBottomRef.current = true;
                setShowScrollButton(false);
                bottomRef.current?.scrollIntoView({
                  behavior: "smooth",
                  block: "end",
                });
              }}
            >
              ↓
            </button>
          ) : null}

          <div className="travel-composer-dock" data-test="travel-composer-dock">
            <div className="travel-composer-dock-inner">
              <TravelComposer flow={flow} docked />
            </div>
          </div>
        </>
      )}

      {!hasConversation && flow.error ? (
        <div className="travel-error">{flow.error}</div>
      ) : null}
      {!hasConversation && flow.busy ? (
        <div className="travel-loading travel-loading-agent">
          <span className="travel-loading-dot" />
          <strong>{workingCopy}</strong>
        </div>
      ) : null}
    </section>
  );
}
