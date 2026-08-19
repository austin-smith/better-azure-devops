"use client";

import {
  type HTMLAttributes,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type LightboxImage = {
  alt: string;
  src: string;
};

type ImageLightboxProps = Omit<
  HTMLAttributes<HTMLElement>,
  "children" | "onClick" | "onKeyDown"
> & {
  as?: "div" | "span";
  children?: ReactNode;
  onClick?: (event: MouseEvent<HTMLElement>) => void;
  onKeyDown?: (event: KeyboardEvent<HTMLElement>) => void;
};

const interactiveImageClassNames = [
  "cursor-zoom-in",
  "transition-opacity",
  "hover:opacity-90",
  "focus-visible:outline-none",
  "focus-visible:ring-2",
  "focus-visible:ring-ring",
  "focus-visible:ring-offset-2",
  "focus-visible:ring-offset-background",
];

function expandableImageLabel(image: HTMLImageElement) {
  return image.alt ? `Expand image: ${image.alt}` : "Expand image";
}

function isLinkedImage(image: HTMLImageElement) {
  return image.closest("a[href]") !== null;
}

function findImage(
  container: HTMLElement | null,
  target: EventTarget | null,
) {
  if (!(target instanceof Element)) {
    return null;
  }

  const image = target.closest("img");

  return image instanceof HTMLImageElement &&
    container?.contains(image) &&
    !isLinkedImage(image)
    ? image
    : null;
}

export function ImageLightbox({
  as = "div",
  children,
  className,
  onClick,
  onKeyDown,
  ...props
}: ImageLightboxProps) {
  const containerRef = useRef<HTMLElement>(null);
  const [expandedImage, setExpandedImage] = useState<LightboxImage | null>(null);

  useEffect(() => {
    const images = containerRef.current
      ?.querySelectorAll<HTMLImageElement>("img[src]") ?? [];

    for (const image of images) {
      if (isLinkedImage(image)) {
        continue;
      }

      image.classList.add(...interactiveImageClassNames);
      image.setAttribute("aria-haspopup", "dialog");
      image.setAttribute("role", "button");

      if (!image.hasAttribute("aria-label")) {
        image.setAttribute("aria-label", expandableImageLabel(image));
      }

      if (!image.hasAttribute("tabindex")) {
        image.tabIndex = 0;
      }
    }
  });

  function expandImage(image: HTMLImageElement) {
    const source = image.currentSrc || image.getAttribute("src");

    if (!source) {
      return;
    }

    setExpandedImage({
      alt: image.alt,
      src: source,
    });
  }

  function handleClick(event: MouseEvent<HTMLElement>) {
    onClick?.(event);

    if (event.defaultPrevented) {
      return;
    }

    const image = findImage(containerRef.current, event.target);

    if (!image) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    expandImage(image);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLElement>) {
    onKeyDown?.(event);

    if (
      event.defaultPrevented ||
      (event.key !== "Enter" && event.key !== " ")
    ) {
      return;
    }

    const image = findImage(containerRef.current, event.target);

    if (!image) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    expandImage(image);
  }

  const contentProps = {
    ...props,
    className: cn(as === "span" && "contents", className),
    onClick: handleClick,
    onKeyDown: handleKeyDown,
    ref: (node: HTMLElement | null) => {
      containerRef.current = node;
    },
  };

  return (
    <>
      {as === "span" ? (
        <span {...contentProps}>{children}</span>
      ) : (
        <div {...contentProps}>{children}</div>
      )}
      <Dialog
        onOpenChange={(open) => {
          if (!open) {
            setExpandedImage(null);
          }
        }}
        open={expandedImage !== null}
      >
        <DialogContent className="w-fit max-w-[calc(100vw-2rem)] overflow-hidden sm:max-w-[calc(100vw-2rem)]">
          <DialogHeader className="min-w-0 pr-8">
            <DialogTitle className="truncate">
              {expandedImage?.alt || "Image preview"}
            </DialogTitle>
          </DialogHeader>
          {expandedImage ? (
            // User-authored images have no trustworthy intrinsic dimensions.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              alt={expandedImage.alt}
              className="max-h-[calc(100dvh-10rem)] max-w-[calc(100vw-4rem)] justify-self-center object-contain"
              decoding="async"
              src={expandedImage.src}
            />
          ) : null}
          <DialogFooter className="p-2">
            <DialogClose
              render={<Button type="button" variant="outline" />}
            >
              Close
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
