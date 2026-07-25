import {
  applyTaskDetailEditableValues,
  createTaskDetailEditableValues,
  getTaskDetailEditableChanges,
  hasTaskDetailEditableChanges,
  serializeEditableMarkdownForAzureDevOps,
} from "@/lib/tasks/task-detail-edit";

describe("task detail edit helpers", () => {
  const detail = {
    areaPath: "Project\\Area\\Platform",
    assignee: "Ada Lovelace",
    assigneeAvatarUrl: "https://example.com/ada.png",
    assigneeValue: "ada@example.com",
    description: {
      content: "Initial **markdown**",
      format: "markdown" as const,
    },
    iterationPath: "Project\\Iteration\\Sprint 1",
    priority: "2",
    title: "Investigate issue",
  };
  const fullDetail = {
    ...detail,
    comments: [],
    id: 42,
    linkedPullRequests: [],
    projectId: "project-id",
    projectImageUrl: null,
    projectName: "Project",
    reason: "Updated",
    revision: 7,
    state: "Active",
    tags: [],
    type: "Task",
    updatedAt: "2025-01-05T12:00:00.000Z",
    url: "https://example.com/task/42",
  };

  it("creates editable values from task detail data", () => {
    expect(createTaskDetailEditableValues(detail)).toEqual({
      areaPath: "Project\\Area\\Platform",
      assignee: {
        avatarUrl: "https://example.com/ada.png",
        label: "Ada Lovelace",
        value: "ada@example.com",
      },
      description: "Initial **markdown**",
      iterationPath: "Project\\Iteration\\Sprint 1",
      priority: "2",
      title: "Investigate issue",
    });
  });

  it("detects changed editable fields", () => {
    const initialValues = createTaskDetailEditableValues(detail);
    const draftValues = {
      ...initialValues,
      assignee: {
        avatarUrl: null,
        label: "Grace Hopper",
        value: "grace@example.com",
      },
      description: "Updated **markdown**",
      title: "Updated title",
    };

    expect(getTaskDetailEditableChanges(initialValues, draftValues)).toEqual({
      assignee: "grace@example.com",
      description: "Updated **markdown**",
      title: "Updated title",
    });
    expect(hasTaskDetailEditableChanges(initialValues, draftValues)).toBe(true);
  });

  it("applies editable values back to task detail data", () => {
    const nextValues = {
      ...createTaskDetailEditableValues(detail),
      description: "Updated **markdown**",
      priority: "1",
      title: "Updated title",
    };

    expect(
      applyTaskDetailEditableValues(
        {
          ...fullDetail,
          description: {
            content: "Initial **markdown**",
            format: "markdown",
          },
        },
        nextValues,
      ),
    ).toMatchObject({
      assignee: "Ada Lovelace",
      assigneeValue: "ada@example.com",
      priority: "1",
      title: "Updated title",
      description: {
        content: "Updated **markdown**",
        format: "markdown",
      },
    });
  });

  it("creates markdown edit drafts from HTML descriptions", () => {
    expect(
      createTaskDetailEditableValues({
        ...detail,
        description: {
          content: [
            "<h1>Heading</h1>",
            "<p>Hello <strong>world</strong> and <em>friends</em>.</p>",
            "<ul><li>First</li><li><del>Second</del></li></ul>",
            '<p><a href="https://example.com">Link</a></p>',
            '<p><a data-vss-mention="version,Ada" href="#">Ada Lovelace</a></p>',
            '<p><span data-vss-mention="version,Grace">Grace Hopper</span></p>',
            "<table><thead><tr><th>Name</th><th>Value</th></tr></thead>",
            "<tbody><tr><td>Priority</td><td>High</td></tr></tbody></table>",
          ].join(""),
          format: "html",
        },
      }).description,
    ).toBe([
      "# Heading",
      "",
      "Hello **world** and _friends_.",
      "",
      "- First",
      "- ~~Second~~",
      "",
      "[Link](https://example.com)",
      "",
      "[Ada Lovelace](./ado-mention/ada)",
      "",
      "[Grace Hopper](./ado-mention/grace)",
      "",
      "| Name | Value |",
      "| --- | --- |",
      "| Priority | High |",
    ].join("\n"));
  });

  it("preserves Azure DevOps orphan nested lists when creating editable markdown", () => {
    expect(
      createTaskDetailEditableValues({
        ...detail,
        description: {
          content: [
            "<ul>",
            "<li>Parent</li>",
            "<ul><li>Child one</li><li>Child two</li></ul>",
            "<li>Second parent</li>",
            "<ul>",
            "<li>Second child</li>",
            "<ul><li>Grandchild</li></ul>",
            "</ul>",
            "</ul>",
          ].join(""),
          format: "html",
        },
      }).description,
    ).toBe([
      "- Parent",
      "    - Child one",
      "    - Child two",
      "- Second parent",
      "    - Second child",
      "        - Grandchild",
    ].join("\n"));
  });

  it("removes whitespace-only lines from empty Azure DevOps blocks", () => {
    expect(
      createTaskDetailEditableValues({
        ...detail,
        description: {
          content: "<div>First line</div><div><br></div><div>Second line</div>",
          format: "html",
        },
      }).description,
    ).toBe("First line\n\nSecond line");
  });

  it("preserves inline markdown inside editable table cells", () => {
    expect(
      createTaskDetailEditableValues({
        ...detail,
        description: {
          content: [
            "<table>",
            "<tr><th>Name</th><th>Reference</th></tr>",
            '<tr><td><strong>API</strong></td><td><a href="https://example.com">Docs</a></td></tr>',
            "<tr><td>A | B</td><td><em>Ready</em></td></tr>",
            "</table>",
          ].join(""),
          format: "html",
        },
      }).description,
    ).toBe([
      "| Name | Reference |",
      "| --- | --- |",
      "| **API** | [Docs](https://example.com) |",
      "| A \\| B | _Ready_ |",
    ].join("\n"));
  });

  it("encodes Azure DevOps mention ids when creating editable markdown", () => {
    expect(
      createTaskDetailEditableValues({
        ...detail,
        description: {
          content:
            '<p><span data-vss-mention="version,Team/Project Member">Ada Lovelace</span></p>',
          format: "html",
        },
      }).description,
    ).toBe("[Ada Lovelace](./ado-mention/team%2Fproject%20member)");
  });

  it("normalizes Azure DevOps mention labels when creating editable markdown", () => {
    expect(
      createTaskDetailEditableValues({
        ...detail,
        description: {
          content:
            '<p><span data-vss-mention="version,Ada">Ada   [Team]\nLovelace</span></p>',
          format: "html",
        },
      }).description,
    ).toBe("[Ada \\[Team\\] Lovelace](./ado-mention/ada)");
  });

  it("serializes editable Azure DevOps mention links back to markdown tokens", () => {
    expect(
      serializeEditableMarkdownForAzureDevOps(
        [
          "Ping [Ada Lovelace](./ado-mention/ada)",
          "Escalate to [Team](./ado-mention/team%2Fproject%20member)",
          "Keep [regular link](https://example.com).",
        ].join("\n"),
      ),
    ).toBe([
      "Ping @<ada>",
      "Escalate to @<team/project member>",
      "Keep [regular link](https://example.com).",
    ].join("\n"));
  });

  it("serializes proxied Azure DevOps asset URLs back to original sources", () => {
    const source =
      "https://dev.azure.com/example/project/_apis/wit/attachments/file?id=1&fileName=diagram(v2).png";
    const proxy = `/api/azure-devops/asset?src=${encodeURIComponent(source)}`;

    expect(
      serializeEditableMarkdownForAzureDevOps(
        [
          `![Diagram](${proxy})`,
          `[Download](${proxy} "diagram")`,
          "![External](https://example.com/image.png)",
        ].join("\n"),
      ),
    ).toBe([
      "![Diagram](<https://dev.azure.com/example/project/_apis/wit/attachments/file?id=1&fileName=diagram(v2).png>)",
      "[Download](<https://dev.azure.com/example/project/_apis/wit/attachments/file?id=1&fileName=diagram(v2).png> \"diagram\")",
      "![External](https://example.com/image.png)",
    ].join("\n"));
  });

  it("creates markdown task list drafts from HTML checkbox lists", () => {
    expect(
      createTaskDetailEditableValues({
        ...detail,
        description: {
          content: [
            "<ul>",
            '<li><input type="checkbox" checked disabled> Shipped <strong>editor</strong></li>',
            '<li><input type="checkbox" disabled> Verify preview</li>',
            "</ul>",
          ].join(""),
          format: "html",
        },
      }).description,
    ).toBe([
      "- [x] Shipped **editor**",
      "- [ ] Verify preview",
    ].join("\n"));
  });

  it("preserves nested HTML checkbox lists when creating editable markdown", () => {
    expect(
      createTaskDetailEditableValues({
        ...detail,
        description: {
          content: [
            "<ul>",
            '<li><input type="checkbox" checked disabled> Parent</li>',
            "<ul>",
            '<li><input type="checkbox" disabled> Child</li>',
            "<ul>",
            '<li><input type="checkbox" disabled> Grandchild</li>',
            "</ul>",
            "</ul>",
            "</ul>",
          ].join(""),
          format: "html",
        },
      }).description,
    ).toBe([
      "- [x] Parent",
      "    - [ ] Child",
      "        - [ ] Grandchild",
    ].join("\n"));
  });

  it("does not mark unchanged HTML descriptions dirty", () => {
    const htmlDetail = {
      ...detail,
      description: {
        content: "<p>Initial <strong>HTML</strong></p>",
        format: "html" as const,
      },
    };
    const initialValues = createTaskDetailEditableValues(htmlDetail);

    expect(getTaskDetailEditableChanges(initialValues, initialValues)).toEqual({});
    expect(hasTaskDetailEditableChanges(initialValues, initialValues)).toBe(false);
    expect(
      applyTaskDetailEditableValues(
        {
          ...fullDetail,
          description: htmlDetail.description,
        },
        initialValues,
      ).description,
    ).toEqual(htmlDetail.description);
  });

  it("saves edited HTML-backed descriptions as markdown", () => {
    const htmlDetail = {
      ...fullDetail,
      description: {
        content: "<p>Initial <strong>HTML</strong></p>",
        format: "html" as const,
      },
    };
    const initialValues = createTaskDetailEditableValues(htmlDetail);
    const draftValues = {
      ...initialValues,
      description: `${initialValues.description}\n\nAdded note.`,
    };

    expect(getTaskDetailEditableChanges(initialValues, draftValues)).toEqual({
      description: "Initial **HTML**\n\nAdded note.",
    });
    expect(applyTaskDetailEditableValues(htmlDetail, draftValues).description).toEqual({
      content: "Initial **HTML**\n\nAdded note.",
      format: "markdown",
    });
  });

  it("saves edited HTML-backed mentions and proxied images as Azure DevOps markdown", () => {
    const source =
      "https://dev.azure.com/example/project/_apis/wit/attachments/file?id=1";
    const proxy = `/api/azure-devops/asset?src=${encodeURIComponent(source)}`;
    const htmlDetail = {
      ...fullDetail,
      description: {
        content: [
          '<p><span data-vss-mention="version,Ada">Ada Lovelace</span></p>',
          `<p><img alt="Diagram" src="${proxy}"></p>`,
        ].join(""),
        format: "html" as const,
      },
    };
    const initialValues = createTaskDetailEditableValues(htmlDetail);
    const draftValues = {
      ...initialValues,
      description: `${initialValues.description}\n\nAdded note.`,
    };

    expect(initialValues.description).toBe([
      "[Ada Lovelace](./ado-mention/ada)",
      "",
      `![Diagram](${proxy})`,
    ].join("\n"));
    expect(getTaskDetailEditableChanges(initialValues, draftValues)).toEqual({
      description: [
        "@<ada>",
        "",
        `![Diagram](${source})`,
        "",
        "Added note.",
      ].join("\n"),
    });
    expect(applyTaskDetailEditableValues(htmlDetail, draftValues).description).toEqual({
      content: [
        "[Ada Lovelace](./ado-mention/ada)",
        "",
        `![Diagram](${proxy})`,
        "",
        "Added note.",
      ].join("\n"),
      format: "markdown",
    });
  });
});
