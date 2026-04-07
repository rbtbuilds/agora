"use client";

import { useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { ProductCardRow } from "./product-card";
import type { Product } from "./product-card";

const SUGGESTIONS = [
  "Find me running shoes under $80",
  "What wool shoes do you have?",
  "Show me kids' shoes",
  "Compare the cheapest loungers",
];

const chatTransport = new DefaultChatTransport({ api: "/api/chat" });

function Chat() {
  const { messages, sendMessage, status } = useChat({
    transport: chatTransport,
  });
  const [input, setInput] = useState("");

  const isLoading = status === "streaming" || status === "submitted";
  const isEmpty = messages.length === 0;

  return (
    <div className="flex flex-col h-full">
      {/* Messages area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {isEmpty && (
          <div className="flex flex-col items-center justify-center h-full gap-6">
            <div className="text-center">
              <h2 className="text-xl font-semibold mb-2">
                Ask Agora anything about products
              </h2>
              <p className="text-secondary text-sm">
                I can search across e-commerce stores to find what you need.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 justify-center max-w-md">
              {SUGGESTIONS.map((suggestion) => (
                <button
                  key={suggestion}
                  onClick={() => {
                    setInput(suggestion);
                  }}
                  className="text-xs px-3 py-2 rounded-lg bg-surface border border-border text-secondary hover:text-[#e5e5e5] hover:border-[#3f3f46] transition-colors"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${
              message.role === "user" ? "justify-start" : "justify-end"
            }`}
          >
            <div
              className={`max-w-[85%] rounded-xl px-4 py-3 ${
                message.role === "user"
                  ? "bg-surface text-[#e5e5e5]"
                  : "bg-accent-dim border border-accent-border text-[#e5e5e5]"
              }`}
            >
              {message.role !== "user" && (
                <p className="text-accent text-xs font-medium mb-1">
                  Agora Agent
                </p>
              )}
              {message.parts.map((part, i) => {
                if (part.type === "text" && part.text) {
                  return (
                    <p key={i} className="text-sm leading-relaxed whitespace-pre-wrap">
                      {part.text}
                    </p>
                  );
                }
                // v6 pattern: tool-<toolName>, states are input-available / output-available
                if (part.type === "tool-searchProducts") {
                  if (part.state === "output-available") {
                    const output = part.output as {
                      products?: Product[];
                      total?: number;
                      error?: string;
                    };
                    if (output.error) {
                      return (
                        <p key={i} className="text-red-400 text-sm">
                          {output.error}
                        </p>
                      );
                    }
                    if (output.products && output.products.length > 0) {
                      return (
                        <div key={i} className="mt-3">
                          <ProductCardRow products={output.products} />
                        </div>
                      );
                    }
                  }
                  if (
                    part.state === "input-available" ||
                    part.state === "input-streaming"
                  ) {
                    return (
                      <p key={i} className="text-secondary text-xs italic">
                        Searching products...
                      </p>
                    );
                  }
                }
                return null;
              })}
            </div>
          </div>
        ))}

        {isLoading && messages[messages.length - 1]?.role === "user" && (
          <div className="flex justify-end">
            <div className="bg-accent-dim border border-accent-border rounded-xl px-4 py-3">
              <p className="text-accent text-xs font-medium mb-1">
                Agora Agent
              </p>
              <div className="flex gap-1">
                <span className="w-2 h-2 bg-accent rounded-full animate-bounce [animation-delay:0ms]" />
                <span className="w-2 h-2 bg-accent rounded-full animate-bounce [animation-delay:150ms]" />
                <span className="w-2 h-2 bg-accent rounded-full animate-bounce [animation-delay:300ms]" />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Input bar */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (input.trim()) {
            sendMessage({ text: input });
            setInput("");
          }
        }}
        className="p-4 border-t border-border flex gap-2"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about any product..."
          className="flex-1 bg-surface border border-border rounded-lg px-4 py-2.5 text-sm text-[#e5e5e5] placeholder:text-secondary outline-none focus:border-accent transition-colors"
          disabled={isLoading}
        />
        <button
          type="submit"
          disabled={isLoading || !input.trim()}
          className="bg-accent hover:bg-[#8b5cf6] disabled:opacity-50 disabled:cursor-not-allowed text-white w-10 h-10 rounded-lg flex items-center justify-center transition-colors text-lg"
        >
          →
        </button>
      </form>
    </div>
  );
}

export { Chat };
