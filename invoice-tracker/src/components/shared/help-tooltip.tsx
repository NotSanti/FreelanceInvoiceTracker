"use client";

import { useState } from "react";
import { IoIosHelpCircleOutline } from "react-icons/io";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function HelpTooltip({ content }: { content: string }) {
  const [open, setOpen] = useState(false);

  return (
    <TooltipProvider delayDuration={Infinity}>
      <Tooltip open={open} onOpenChange={setOpen}>
        <TooltipTrigger
          asChild
          onPointerDown={(event) => {
            event.preventDefault();
            setOpen((current) => !current);
          }}
        >
          <button
            type="button"
            className="inline-flex size-3.5 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            aria-label="More information"
            aria-expanded={open}
          >
            <IoIosHelpCircleOutline className="size-3" aria-hidden />
          </button>
        </TooltipTrigger>
        <TooltipContent
          side="top"
          sideOffset={6}
          className="max-w-xs px-3 py-2 text-left text-xs leading-relaxed"
        >
          {content}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
