// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { ProjectImage } from "@/components/project-image";

vi.mock("next/image", () => ({
  default: ({
    alt,
    className,
    onError,
    onLoad,
    src,
  }: {
    alt: string;
    className?: string;
    onError?: () => void;
    onLoad?: () => void;
    src: string;
  }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      alt={alt}
      className={className}
      data-testid="project-image"
      onError={onError}
      onLoad={onLoad}
      src={src}
    />
  ),
}));

describe("ProjectImage", () => {
  it("proxies Azure DevOps project images through the asset route", () => {
    render(
      <ProjectImage
        imageUrl="https://dev.azure.com/example/_apis/projects/1/image"
        name="Platform"
      />,
    );

    expect(screen.getByTestId("project-image")).toHaveAttribute(
      "src",
      "/api/azure-devops/asset?src=https%3A%2F%2Fdev.azure.com%2Fexample%2F_apis%2Fprojects%2F1%2Fimage",
    );
    expect(screen.getByTestId("project-image")).toHaveClass("rounded-md");
  });

  it("falls back to initials when the project image fails", () => {
    render(
      <ProjectImage
        imageUrl="https://dev.azure.com/example/_apis/projects/1/image"
        name="Platform Services"
      />,
    );

    fireEvent.error(screen.getByTestId("project-image"));

    expect(screen.getByText("PS")).toBeInTheDocument();
    expect(screen.queryByTestId("project-image")).not.toBeInTheDocument();
  });

  it("keeps rendering the image without waiting for a load event", () => {
    render(
      <ProjectImage
        imageUrl="https://dev.azure.com/example/_apis/projects/1/image"
        name="Platform"
      />,
    );

    expect(screen.getByTestId("project-image")).toBeInTheDocument();
    expect(screen.queryByText("P")).not.toBeInTheDocument();
  });
});
