import { matchDestinationFromPrompt } from "./agentic-fixtures";

export type TravelIntakeSlot =
  | "destination"
  | "startDate"
  | "duration"
  | "budget";

export type TravelIntakeAssessment = {
  complete: boolean;
  missing: TravelIntakeSlot[];
  question: string;
};

export type TravelLanguage = "en" | "vi";

function resolveLanguage(prompt: string, language?: TravelLanguage): TravelLanguage {
  if (language) return language;
  return /[ăâđêôơưàáảãạèéẻẽẹìíỉĩịòóỏõọùúủũụỳýỷỹỵ]|\b(?:tôi|bạn|muốn|đi|ngày|ngân sách|khách sạn|chuyến)\b/i.test(
    prompt,
  )
    ? "vi"
    : "en";
}

function hasStartDate(prompt: string) {
  return (
    /\b20\d{2}-\d{2}-\d{2}\b/.test(prompt) ||
    /\b\d{1,2}[\/-]\d{1,2}[\/-]20\d{2}\b/.test(prompt) ||
    /\b(?:tomorrow|next\s+(?:week|month)|this\s+(?:week|month)|ngày mai|ngay mai|tuần sau|tuan sau|tháng sau|thang sau)\b/i.test(
      prompt,
    )
  );
}

function hasDuration(prompt: string) {
  return /\b\d+\s*-?\s*(?:day|days|night|nights|ngày|ngay|đêm|dem)\b/i.test(prompt);
}

function hasBudget(prompt: string) {
  return (
    /\$\s*[\d,]+/.test(prompt) ||
    /[\d,]+\s*(?:\$|usd|đô|do)\b/i.test(prompt) ||
    /(?:budget|ngân sách|ngan sach|tôi có|toi co|i have|max|maximum)\s*(?:is|là|la|:)?\s*\$?\s*[\d,]+/i.test(
      prompt,
    )
  );
}

function questionFor(
  missing: TravelIntakeSlot[],
  language: TravelLanguage,
) {
  if (language === "en") {
    if (missing.length === 1) {
      if (missing[0] === "destination") {
        return "Where would you like to go? Please give me a destination city or country.";
      }
      if (missing[0] === "startDate") {
        return "What date would you like to start the trip?";
      }
      if (missing[0] === "duration") {
        return "How many days would you like to travel for?";
      }
      return "What is your maximum whole-trip budget in USD?";
    }

    const labels = missing.map((slot) => {
      if (slot === "destination") return "destination";
      if (slot === "startDate") return "start date";
      if (slot === "duration") return "trip duration";
      return "maximum budget (USD)";
    });

    return (
      "I still need " +
      labels.join(", ") +
      " to build a suitable combo. You can answer in one message."
    );
  }

  if (missing.length === 1) {
    if (missing[0] === "destination") {
      return "Bạn muốn đi đâu? Hãy cho tôi thành phố hoặc quốc gia đích.";
    }
    if (missing[0] === "startDate") {
      return "Bạn muốn bắt đầu chuyến đi ngày nào?";
    }
    if (missing[0] === "duration") {
      return "Bạn muốn đi trong bao nhiêu ngày?";
    }
    return "Ngân sách tối đa cho toàn chuyến là bao nhiêu USD?";
  }

  const labels = missing.map((slot) => {
    if (slot === "destination") return "điểm đến";
    if (slot === "startDate") return "ngày khởi hành";
    if (slot === "duration") return "số ngày";
    return "ngân sách tối đa (USD)";
  });

  return (
    "Tôi cần thêm " +
    labels.join(", ") +
    " để tìm và tự ghép combo phù hợp. Bạn có thể trả lời trong một tin nhắn."
  );
}

export function assessTravelIntake(
  prompt: string,
  language?: TravelLanguage,
): TravelIntakeAssessment {
  const missing: TravelIntakeSlot[] = [];

  if (!matchDestinationFromPrompt(prompt)) missing.push("destination");
  if (!hasStartDate(prompt)) missing.push("startDate");
  if (!hasDuration(prompt)) missing.push("duration");
  if (!hasBudget(prompt)) missing.push("budget");

  return {
    complete: missing.length === 0,
    missing,
    question: questionFor(missing, resolveLanguage(prompt, language)),
  };
}

export function travelChangeClarification(
  prompt: string,
  language?: TravelLanguage,
) {
  const resolvedLanguage = resolveLanguage(prompt, language);
  const scheduleRequest =
    /reschedule|change (?:my )?(?:trip )?date|move (?:my )?trip|đổi lịch|doi lich|đổi ngày|doi ngay|dời lịch|dời ngày|dời chuyến đi|doi chuyen di/i.test(
      prompt,
    );
  const hasConcreteSchedule =
    hasStartDate(prompt) || /\b\d+\s*(?:day|days|ngày|ngay)\s*(?:later|earlier|sau|trước|truoc)?\b/i.test(prompt);
  if (scheduleRequest && !hasConcreteSchedule) {
    return resolvedLanguage === "vi"
      ? "Bạn muốn đổi sang ngày nào?"
      : "What date would you like to move the trip to?";
  }

  const budgetRequest =
    /(?:change|update|increase|decrease|đổi|doi|tăng|tang|giảm|giam)\s+(?:the\s+|my\s+|trip\s+|toàn\s+chuyến\s+|toan\s+chuyen\s+)?(?:budget|ngân sách|ngan sach)/i.test(
      prompt,
    );
  if (budgetRequest && !hasBudget(prompt)) {
    return resolvedLanguage === "vi"
      ? "Ngân sách mới cho toàn chuyến là bao nhiêu USD?"
      : "What should the new whole-trip budget be in USD?";
  }

  return null;
}

export function mergeTravelIntakeAnswer(input: {
  current: string;
  answer: string;
  missing: TravelIntakeSlot[];
}) {
  const answer = input.answer.trim();
  if (!input.current.trim()) return answer;

  if (input.missing.length === 1) {
    const slot = input.missing[0]!;
    if (slot === "budget" && /^\$?[\d,]+\$?$/.test(answer)) {
      return input.current + "\nBudget $" + answer.replace(/\$/g, "");
    }
    if (slot === "duration" && /^\d+$/.test(answer)) {
      return input.current + "\nDuration " + answer + " days";
    }
    if (slot === "startDate") {
      return input.current + "\nStart date " + answer;
    }
    if (slot === "destination") {
      return input.current + "\nDestination " + answer;
    }
  }

  return input.current + "\n" + answer;
}
