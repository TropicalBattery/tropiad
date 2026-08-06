"use client";

import { X } from "lucide-react";
import {
  forwardRef,
  KeyboardEvent,
  useCallback,
  useImperativeHandle,
  useMemo,
  useState,
} from "react";
import { flushSync } from "react-dom";

import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { normalizeStringArray } from "@/lib/validations/brand-config-normalize";

type TagInputProps = {
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  prefix?: string;
  suggestions?: readonly string[];
  className?: string;
};

export type TagInputHandle = {
  flushPendingInput: () => string[];
};

function cleanTag(raw: string): string {
  return raw.trim().replace(/^@+/, "");
}

function isValidNewTag(tag: string, existingTags: string[]): boolean {
  return Boolean(tag) && tag !== "[]" && !existingTags.includes(tag);
}

export const TagInput = forwardRef<TagInputHandle, TagInputProps>(
  function TagInput(
    {
      value,
      onChange,
      placeholder = "Type and press Enter",
      prefix,
      suggestions,
      className,
    },
    ref
  ) {
    const [input, setInput] = useState("");

    const tags = useMemo(() => normalizeStringArray(value), [value]);

    const filteredSuggestions = useMemo(() => {
      if (!suggestions?.length) {
        return [];
      }

      const query = input.trim().toLowerCase();
      if (!query) {
        return [];
      }

      return suggestions.filter(
        (suggestion) =>
          !tags.includes(suggestion) &&
          suggestion.toLowerCase().includes(query)
      );
    }, [input, suggestions, tags]);

    const commitTags = useCallback(
      (nextTags: string[]) => {
        flushSync(() => {
          onChange(nextTags);
        });
      },
      [onChange]
    );

    const buildNextTags = useCallback(
      (raw: string, baseTags: string[] = tags): string[] | null => {
        const tag = cleanTag(raw);
        if (!isValidNewTag(tag, baseTags)) {
          return null;
        }

        return [...baseTags, tag];
      },
      [tags]
    );

    function addTag(raw: string) {
      const nextTags = buildNextTags(raw);
      if (!nextTags) {
        setInput("");
        return tags;
      }

      commitTags(nextTags);
      setInput("");
      return nextTags;
    }

    const flushPendingInputStable = useCallback((): string[] => {
      const pending = input.trim();
      if (!pending) {
        return tags;
      }

      const nextTags = buildNextTags(pending);
      if (!nextTags) {
        setInput("");
        return tags;
      }

      commitTags(nextTags);
      setInput("");
      return nextTags;
    }, [input, tags, buildNextTags, commitTags]);

    useImperativeHandle(
      ref,
      () => ({ flushPendingInput: flushPendingInputStable }),
      [flushPendingInputStable]
    );

    function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
      if (event.key === "Enter") {
        event.preventDefault();
        addTag(input);
      } else if (event.key === "Backspace" && !input && tags.length > 0) {
        commitTags(tags.slice(0, -1));
      }
    }

    function removeTag(tag: string) {
      commitTags(tags.filter((item) => item !== tag));
    }

    return (
      <div className={cn("relative", className)}>
        <div
          className={cn(
            "flex min-h-10 w-full flex-wrap items-center gap-2 rounded-md border border-input bg-background px-3 py-2 focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2"
          )}
        >
          {tags.map((tag) => (
            <Badge
              key={tag}
              variant="secondary"
              className="gap-1 bg-[#0D9488]/10 text-[#0B1C3D] hover:bg-[#0D9488]/20"
            >
              {prefix}
              {tag}
              <button
                type="button"
                onClick={() => removeTag(tag)}
                className="rounded-full hover:bg-black/10"
                aria-label={`Remove ${tag}`}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
          <Input
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={() => {
              if (input.trim()) {
                addTag(input);
              }
            }}
            placeholder={tags.length === 0 ? placeholder : ""}
            className="h-7 min-w-[120px] flex-1 border-0 px-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
          />
        </div>
        {filteredSuggestions.length > 0 ? (
          <ul
            className="absolute z-10 mt-1 max-h-48 w-full overflow-y-auto rounded-md border border-input bg-background py-1 shadow-md"
            role="listbox"
          >
            {filteredSuggestions.map((suggestion) => (
              <li key={suggestion}>
                <button
                  type="button"
                  className="w-full px-3 py-2 text-left text-sm hover:bg-[#1a1a2e]"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => addTag(suggestion)}
                >
                  {suggestion}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    );
  }
);

TagInput.displayName = "TagInput";
