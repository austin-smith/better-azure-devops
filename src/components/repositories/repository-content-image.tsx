import { ImageLightbox } from "@/components/image-lightbox";
import { cn } from "@/lib/utils";

export function RepositoryContentImage({
  alt,
  className,
  src,
  title,
}: {
  alt: string;
  className?: string;
  src: string;
  title?: string;
}) {
  return (
    <ImageLightbox as="span">
      {/* Repository content does not expose trustworthy intrinsic dimensions at
          render time. A native image preserves the source aspect ratio instead of
          reserving space from fabricated width and height values. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        alt={alt}
        aria-haspopup="dialog"
        aria-label={alt ? `Expand image: ${alt}` : "Expand image"}
        className={cn(
          "h-auto w-auto max-w-full cursor-zoom-in object-contain transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          className,
        )}
        decoding="async"
        loading="lazy"
        role="button"
        src={src}
        tabIndex={0}
        title={title}
      />
    </ImageLightbox>
  );
}
