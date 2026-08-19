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
        className={cn(
          "h-auto w-auto max-w-full object-contain",
          className,
        )}
        decoding="async"
        loading="lazy"
        src={src}
        title={title}
      />
    </ImageLightbox>
  );
}
