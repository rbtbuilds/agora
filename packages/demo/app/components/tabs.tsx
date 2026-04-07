"use client";

import { useState } from "react";
import { Chat } from "./chat";
import { Explore } from "./explore";

type Tab = "chat" | "explore";

function Tabs() {
  const [activeTab, setActiveTab] = useState<Tab>("chat");

  return (
    <div className="flex flex-col h-full">
      <div className="flex gap-1 border-b border-border px-4">
        <button
          onClick={() => setActiveTab("chat")}
          className={`px-4 py-2.5 text-sm font-medium transition-colors relative ${
            activeTab === "chat"
              ? "text-accent"
              : "text-secondary hover:text-[#e5e5e5]"
          }`}
        >
          Chat
          {activeTab === "chat" && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent rounded-full" />
          )}
        </button>
        <button
          onClick={() => setActiveTab("explore")}
          className={`px-4 py-2.5 text-sm font-medium transition-colors relative ${
            activeTab === "explore"
              ? "text-accent"
              : "text-secondary hover:text-[#e5e5e5]"
          }`}
        >
          Explore
          {activeTab === "explore" && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent rounded-full" />
          )}
        </button>
      </div>
      <div className="flex-1 overflow-hidden">
        <div className={activeTab === "chat" ? "h-full" : "hidden"}>
          <Chat />
        </div>
        <div className={activeTab === "explore" ? "h-full" : "hidden"}>
          <Explore />
        </div>
      </div>
    </div>
  );
}

export { Tabs };
export type { Tab };
