"use client";

import { useEffect, useRef } from "react";

import { useAppLanguage } from "@/components/i18n/AppLanguageProvider";
import type { TravelAgentFlowController } from "./useTravelAgentFlow";

export function TravelComposer({
  flow,
  docked,
}: {
  flow: TravelAgentFlowController;
  docked: boolean;
}) {
  const { language } = useAppLanguage();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
  }, [flow.prompt]);

  return (
    <form
      className={
        docked
          ? "travel-chat-composer is-docked"
          : "travel-chat-composer is-centered"
      }
      data-test="travel-composer"
      data-tour={flow.plan ? "travel-change-prompt" : undefined}
      data-wallet-connected={flow.walletConnected ? "true" : "false"}
      onSubmit={(event) => void flow.submitPrompt(event)}
    >
      <textarea
        ref={textareaRef}
        id="travel-agent-prompt"
        data-test="travel-agent-prompt"
        data-tour="travel-trip-prompt"
        value={flow.prompt}
        onChange={(event) => flow.setPrompt(event.target.value)}
        onKeyDown={flow.handleKeyDown}
        aria-label={
          flow.plan
            ? language === "vi"
              ? "Nhắn cho trợ lý du lịch"
              : "Message your travel agent"
            : language === "vi"
              ? "Yêu cầu chuyến đi"
              : "Trip request"
        }
        placeholder={
          flow.clarificationQuestion
            ? language === "vi"
              ? "Trả lời để AI hoàn tất yêu cầu…"
              : "Reply so the AI can complete your request…"
            : flow.plan
              ? language === "vi"
                ? "Nói tiếp với AI… ví dụ: đổi khách sạn yên tĩnh hơn nhưng giữ nguyên ngân sách"
                : "Tell the AI what to change… e.g. choose a quieter hotel but keep the same budget"
              : language === "vi"
                ? "Lên kế hoạch Tokyo từ 2026-11-07 trong 4 ngày, ngân sách $1,200"
                : "Plan Tokyo from 2026-11-07 for 4 days, budget $1,200"
        }
        rows={1}
      />

      {!flow.walletConnected && !docked ? (
        <small className="travel-composer-lock">
          {language === "vi" ? "Không cần ví để lên kế hoạch" : "No wallet needed to plan"}
        </small>
      ) : null}

      <div className="travel-chat-composer-actions">
        <button
          className="travel-chat-icon-button"
          type="button"
          onClick={flow.startSpeech}
          disabled={!flow.speechSupported || flow.busy}
          aria-label={language === "vi" ? "Nhập bằng giọng nói" : "Use voice input"}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 14.5a3.5 3.5 0 0 0 3.5-3.5V6a3.5 3.5 0 1 0-7 0v5a3.5 3.5 0 0 0 3.5 3.5Z" />
            <path d="M5.8 10.8v.4a6.2 6.2 0 0 0 12.4 0v-.4M12 17.4V21M9.2 21h5.6" />
          </svg>
        </button>

        <button
          className="travel-chat-icon-button is-send"
          data-tour="travel-send-prompt"
          type="submit"
          disabled={flow.busy || flow.prompt.trim().length < 2}
          aria-label={
            flow.plan
              ? language === "vi"
                ? "Gửi thay đổi chuyến đi"
                : "Send trip change"
              : language === "vi"
                ? "Gửi yêu cầu chuyến đi"
                : "Send trip request"
          }
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="m5 12 14-7-4.8 14-2.5-5.2L5 12Z" />
            <path d="m11.7 13.8 3.7-3.7" />
          </svg>
        </button>
      </div>
    </form>
  );
}
