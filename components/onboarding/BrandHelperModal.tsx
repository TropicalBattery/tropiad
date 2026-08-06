"use client";

import { Loader2, Sparkles, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type {
  BrandHelperApplyUpdates,
  BrandHelperOutput,
} from "@/lib/types/brand-helper";
import { mapBrandHelperTone } from "@/lib/types/brand-helper";
import { cn } from "@/lib/utils";

type BrandHelperModalProps = {
  companyId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApply: (updates: BrandHelperApplyUpdates) => void;
};

type PanelStep = "questions" | "review";

type ReviewFieldKey =
  | "unique_selling_point"
  | "target_audience"
  | "brand_voice_doc"
  | "tone";

type QuestionConfig = {
  heading: string;
  placeholder: string;
};

const QUESTIONS: QuestionConfig[] = [
  {
    heading: "What do you do?",
    placeholder:
      "e.g. We sell and install windows and doors made from uPVC, built to handle Caribbean weather",
  },
  {
    heading: "Who's your ideal customer?",
    placeholder:
      "e.g. Homeowners renovating, or builders working on new construction",
  },
  {
    heading: "What makes you different from competitors?",
    placeholder:
      "e.g. Our products are specifically designed for hurricanes and don't rust or rot like other materials",
  },
  {
    heading: "How would you describe your brand's personality?",
    placeholder:
      "e.g. Professional but approachable, like a knowledgeable friend, not a pushy salesperson",
  },
];

const ACKNOWLEDGMENTS = [
  "Got it - thanks for the overview.",
  "That's helpful context on your audience.",
  "Good to know what sets you apart.",
];

const REVIEW_FIELDS: Array<{
  key: ReviewFieldKey;
  label: string;
  applyKey: keyof BrandHelperApplyUpdates;
}> = [
  {
    key: "unique_selling_point",
    label: "Unique selling point",
    applyKey: "uniqueSellingPoint",
  },
  {
    key: "target_audience",
    label: "Target audience",
    applyKey: "targetAudience",
  },
  {
    key: "brand_voice_doc",
    label: "Brand voice document",
    applyKey: "brandVoiceDoc",
  },
  {
    key: "tone",
    label: "Tone",
    applyKey: "tone",
  },
];

const EMPTY_ANSWERS = ["", "", "", ""];

export function BrandHelperTriggerButton({
  onClick,
}: {
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      className="h-auto px-0 text-tbc-red hover:bg-tbc-red/5 hover:text-tbc-red"
      onClick={onClick}
    >
      <Sparkles className="mr-2 h-4 w-4" />
      ✨ Help me write this
    </Button>
  );
}

export function BrandHelperModal({
  companyId,
  open,
  onOpenChange,
  onApply,
}: BrandHelperModalProps) {
  const [step, setStep] = useState<PanelStep>("questions");
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<string[]>(EMPTY_ANSWERS);
  const [output, setOutput] = useState<BrandHelperOutput | null>(null);
  const [acceptedFields, setAcceptedFields] = useState<Set<ReviewFieldKey>>(
    new Set()
  );
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentAnswer = answers[currentQuestionIndex] ?? "";
  const canAdvanceCurrent = currentAnswer.trim().length >= 10;
  const isLastQuestion = currentQuestionIndex === QUESTIONS.length - 1;
  const currentQuestion = QUESTIONS[currentQuestionIndex];

  const canGenerate = useMemo(
    () => answers.every((answer) => answer.trim().length >= 10),
    [answers]
  );

  useEffect(() => {
    if (!open) {
      setStep("questions");
      setCurrentQuestionIndex(0);
      setAnswers(EMPTY_ANSWERS);
      setOutput(null);
      setAcceptedFields(new Set());
      setSelectedTopics([]);
      setLoading(false);
      setError(null);
    }
  }, [open]);

  function updateCurrentAnswer(value: string) {
    setAnswers((current) =>
      current.map((answer, index) =>
        index === currentQuestionIndex ? value : answer
      )
    );
  }

  function getFieldValue(key: ReviewFieldKey): string {
    if (!output) {
      return "";
    }

    if (key === "tone") {
      return mapBrandHelperTone(output.tone);
    }

    return output[key];
  }

  function buildFieldUpdate(
    key: ReviewFieldKey
  ): BrandHelperApplyUpdates | null {
    if (!output) {
      return null;
    }

    switch (key) {
      case "unique_selling_point":
        return { uniqueSellingPoint: output.unique_selling_point };
      case "target_audience":
        return { targetAudience: output.target_audience };
      case "brand_voice_doc":
        return { brandVoiceDoc: output.brand_voice_doc };
      case "tone":
        return { tone: mapBrandHelperTone(output.tone) };
      default:
        return null;
    }
  }

  function handleUseField(key: ReviewFieldKey) {
    const updates = buildFieldUpdate(key);
    if (!updates) {
      return;
    }

    onApply(updates);
    setAcceptedFields((current) => {
      const next = new Set(current);
      next.add(key);
      return next;
    });
  }

  function toggleTopic(topic: string, checked: boolean) {
    setSelectedTopics((current) =>
      checked
        ? [...current, topic]
        : current.filter((item) => item !== topic)
    );
  }

  async function handleGenerate() {
    if (!canGenerate) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/admin/brand-helper", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          companyId,
          whatYouDo: answers[0].trim(),
          idealCustomer: answers[1].trim(),
          whatMakesYouDifferent: answers[2].trim(),
          personality: answers[3].trim(),
        }),
      });

      const payload = (await response.json()) as {
        data: BrandHelperOutput | null;
        error: string | null;
      };

      if (!response.ok || payload.error || !payload.data) {
        throw new Error(payload.error ?? "Failed to generate brand content.");
      }

      setOutput(payload.data);
      setSelectedTopics(payload.data.suggested_topics_to_cover);
      setAcceptedFields(new Set());
      setStep("review");
    } catch (generateError) {
      const message =
        generateError instanceof Error
          ? generateError.message
          : "Failed to generate brand content.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  function handleNext() {
    if (!canAdvanceCurrent || loading) {
      return;
    }

    if (isLastQuestion) {
      void handleGenerate();
      return;
    }

    setCurrentQuestionIndex((index) => index + 1);
    setError(null);
  }

  function handleBack() {
    if (currentQuestionIndex === 0 || loading) {
      return;
    }

    setCurrentQuestionIndex((index) => index - 1);
    setError(null);
  }

  function handleApplySelectedAndClose() {
    if (!output) {
      return;
    }

    const updates: BrandHelperApplyUpdates = {};

    for (const field of REVIEW_FIELDS) {
      if (acceptedFields.has(field.key)) {
        const fieldUpdate = buildFieldUpdate(field.key);
        if (fieldUpdate?.uniqueSellingPoint) {
          updates.uniqueSellingPoint = fieldUpdate.uniqueSellingPoint;
        }
        if (fieldUpdate?.targetAudience) {
          updates.targetAudience = fieldUpdate.targetAudience;
        }
        if (fieldUpdate?.brandVoiceDoc) {
          updates.brandVoiceDoc = fieldUpdate.brandVoiceDoc;
        }
        if (fieldUpdate?.tone) {
          updates.tone = fieldUpdate.tone;
        }
      }
    }

    if (selectedTopics.length > 0) {
      updates.topicsToCover = selectedTopics;
    }

    if (Object.keys(updates).length > 0) {
      onApply(updates);
    }

    onOpenChange(false);
  }

  function handleStartOver() {
    setStep("questions");
    setCurrentQuestionIndex(0);
    setAnswers(EMPTY_ANSWERS);
    setOutput(null);
    setAcceptedFields(new Set());
    setSelectedTopics([]);
    setError(null);
  }

  return (
    <>
      <div
        className={cn(
          "fixed inset-0 z-40 bg-black/50 transition-opacity duration-300",
          open ? "opacity-100" : "pointer-events-none opacity-0"
        )}
        onClick={() => onOpenChange(false)}
        aria-hidden={!open}
      />

      <aside
        className={cn(
          "fixed inset-y-0 right-0 z-50 flex w-full transform flex-col bg-white dark:bg-[#161616] shadow-xl transition-transform duration-300 ease-in-out sm:w-[420px]",
          open ? "translate-x-0" : "translate-x-full"
        )}
        aria-hidden={!open}
        aria-label="Brand helper assistant"
      >
        <div className="flex items-center justify-between border-b border-[#E5E7EB] dark:border-[#2a2a2a] px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#CC2B2B] text-white dark:bg-tbc-red">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <p className="font-semibold text-[#111111] dark:text-white">Brand assistant</p>
              <p className="text-xs text-[#9ca3af] dark:text-slate-500">
                {step === "questions"
                  ? "Let's figure out your brand together"
                  : "Review suggestions"}
              </p>
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => onOpenChange(false)}
            aria-label="Close brand assistant"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-6">
          {step === "questions" ? (
            <div className="space-y-5">
              {currentQuestionIndex > 0 ? (
                <div className="rounded-2xl rounded-tl-sm bg-[#1a1a2e] px-4 py-3 text-sm text-[#374151] dark:text-slate-300">
                  {ACKNOWLEDGMENTS[currentQuestionIndex - 1]}
                </div>
              ) : null}

              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#CC2B2B] text-white dark:bg-tbc-red">
                  <Sparkles className="h-3.5 w-3.5" />
                </div>
                <h2 className="text-lg font-semibold text-[#111111] dark:text-white">
                  {currentQuestion.heading}
                </h2>
              </div>

              <div className="space-y-2">
                <Label htmlFor={`brand-helper-question-${currentQuestionIndex}`}>
                  Your answer
                </Label>
                <Textarea
                  id={`brand-helper-question-${currentQuestionIndex}`}
                  value={currentAnswer}
                  onChange={(event) => updateCurrentAnswer(event.target.value)}
                  rows={5}
                  placeholder={currentQuestion.placeholder}
                  disabled={loading}
                />
              </div>

              <div className="flex items-center justify-center gap-2 pt-1">
                {QUESTIONS.map((_, index) => (
                  <span
                    key={index}
                    className={cn(
                      "h-2 w-2 rounded-full transition-colors",
                      index === currentQuestionIndex
                        ? "bg-tbc-red"
                        : index < currentQuestionIndex
                          ? "bg-tbc-red/40"
                          : "bg-slate-600"
                    )}
                    aria-label={`Question ${index + 1}${index === currentQuestionIndex ? ", current" : index < currentQuestionIndex ? ", completed" : ""}`}
                  />
                ))}
              </div>

              {error ? (
                <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                  {error}
                  <div className="mt-3">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setError(null);
                        void handleGenerate();
                      }}
                    >
                      Try Again
                    </Button>
                  </div>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="space-y-5">
              <p className="text-sm text-[#6b7280] dark:text-slate-400">
                Here&apos;s what I&apos;d suggest based on what you told me:
              </p>

              {REVIEW_FIELDS.map((field) => {
                if (acceptedFields.has(field.key)) {
                  return null;
                }

                return (
                  <div key={field.key} className="space-y-2">
                    <Label>{field.label}</Label>
                    <div className="rounded-lg border border-[#E5E7EB] bg-[#f8fafc] dark:border-[#2a2a2a] dark:bg-[#0a0a0a] p-4 text-sm text-[#374151] dark:text-slate-300">
                      <p className="whitespace-pre-wrap">
                        {getFieldValue(field.key)}
                      </p>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      className="bg-tbc-red hover:bg-tbc-red-hover"
                      onClick={() => handleUseField(field.key)}
                    >
                      Use this
                    </Button>
                  </div>
                );
              })}

              {output ? (
                <div className="space-y-3">
                  <Label>Suggested topics to cover</Label>
                  <div className="space-y-2 rounded-lg border border-[#E5E7EB] bg-[#f8fafc] dark:border-[#2a2a2a] dark:bg-[#0a0a0a] p-4">
                    {output.suggested_topics_to_cover.map((topic) => {
                      const checkboxId = `topic-${topic.replace(/\s+/g, "-")}`;

                      return (
                        <div key={topic} className="flex items-start gap-3">
                          <Checkbox
                            id={checkboxId}
                            checked={selectedTopics.includes(topic)}
                            onCheckedChange={(checked) =>
                              toggleTopic(topic, checked === true)
                            }
                          />
                          <Label
                            htmlFor={checkboxId}
                            className="cursor-pointer font-normal leading-snug"
                          >
                            {topic}
                          </Label>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </div>

        <div className="border-t border-[#E5E7EB] dark:border-[#2a2a2a] px-5 py-4">
          {step === "questions" ? (
            <div className="flex items-center justify-between gap-3">
              <Button
                type="button"
                variant="ghost"
                disabled={currentQuestionIndex === 0 || loading}
                onClick={handleBack}
              >
                Back
              </Button>
              <Button
                type="button"
                className="bg-tbc-red hover:bg-tbc-red-hover"
                disabled={!canAdvanceCurrent || loading}
                onClick={handleNext}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Thinking...
                  </>
                ) : isLastQuestion ? (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    Generate
                  </>
                ) : (
                  "Next"
                )}
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-between">
              <Button type="button" variant="outline" onClick={handleStartOver}>
                Start Over
              </Button>
              <Button
                type="button"
                className="bg-tbc-red hover:bg-tbc-red-hover"
                onClick={handleApplySelectedAndClose}
              >
                Apply Selected &amp; Close
              </Button>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
