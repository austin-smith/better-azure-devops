import { createMalformedResponseError } from "@/lib/azure-devops/errors";
import { stripRefPrefix } from "@/lib/azure-devops/git/urls";
import type {
  AzureGitCommitChange,
  AzureGitCommitDetail,
  AzureGitCommitSummary,
  AzureGitItem,
  AzureGitPolicyEvaluation,
  AzureGitPullRequest,
  AzureGitPullRequestChange,
  AzureGitPullRequestComment,
  AzureGitPullRequestIteration,
  AzureGitPullRequestReviewer,
  AzureGitPullRequestStatusCheck,
  AzureGitPullRequestThread,
  AzureGitPullRequestThreadActivity,
  AzureGitPullRequestThreadStatus,
  AzureGitPullRequestVote,
  AzureGitPush,
  AzureGitRef,
  AzureGitRepository,
  AzureGitSearchResult,
} from "@/lib/azure-devops/git/types";

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function readArray(value: unknown) {
  return Array.isArray(value) ? value : [];
}

export function readBoolean(value: unknown, fallback = false) {
  return typeof value === "boolean" ? value : fallback;
}

export function readNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function readString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function readExactString(value: unknown) {
  return typeof value === "string" && value.trim() ? value : null;
}

export function readIdentity(value: unknown) {
  if (!isRecord(value)) {
    return null;
  }

  const displayName = readString(value.displayName);

  if (!displayName) {
    return null;
  }

  return {
    displayName,
    imageUrl:
      readString(value.imageUrl) ??
      (isRecord(value._links) && isRecord(value._links.avatar)
        ? readString(value._links.avatar.href)
        : null),
  };
}

function readGitIdentity(value: unknown) {
  const identity = readIdentity(value);

  if (!identity || !isRecord(value)) {
    return null;
  }

  return {
    ...identity,
    id: readString(value.id),
    isContainer: readBoolean(value.isContainer),
  };
}

function readPullRequestVote(value: unknown): AzureGitPullRequestVote {
  const vote = readNumber(value);

  return vote === -10 || vote === -5 || vote === 5 || vote === 10
    ? vote
    : 0;
}

function readPullRequestThreadStatus(
  value: unknown,
): AzureGitPullRequestThreadStatus {
  const status = readString(value);

  switch (status) {
    case "active":
    case "byDesign":
    case "closed":
    case "fixed":
    case "pending":
    case "wontFix":
      return status;
    default:
      return "unknown";
  }
}

function readPosition(value: unknown) {
  if (!isRecord(value)) {
    return null;
  }

  const line = readNumber(value.line);
  const offset = readNumber(value.offset);

  return line !== null && offset !== null ? { line, offset } : null;
}

function parsePullRequestReviewer(
  value: unknown,
): AzureGitPullRequestReviewer | null {
  const identity = readGitIdentity(value);

  if (!identity || !isRecord(value)) {
    return null;
  }

  return {
    ...identity,
    hasDeclined: readBoolean(value.hasDeclined),
    isFlagged: readBoolean(value.isFlagged),
    isRequired: readBoolean(value.isRequired),
    vote: readPullRequestVote(value.vote),
    votedFor: readArray(value.votedFor).flatMap((reviewer) => {
      const votedForIdentity = readGitIdentity(reviewer);

      return votedForIdentity && isRecord(reviewer)
        ? [
            {
              displayName: votedForIdentity.displayName,
              id: votedForIdentity.id,
              vote: readPullRequestVote(reviewer.vote),
            },
          ]
        : [];
    }),
  };
}

function readGitPerson(value: unknown) {
  if (!isRecord(value)) {
    return {
      date: null,
      email: null,
      imageUrl: null,
      name: null,
    };
  }

  return {
    date: readString(value.date),
    email: readString(value.email),
    imageUrl: readString(value.imageUrl),
    name: readString(value.name),
  };
}

function readProject(
  value: unknown,
  operation: string,
) {
  if (!isRecord(value)) {
    throw createMalformedResponseError(operation);
  }

  const id = readString(value.id);
  const name = readString(value.name);

  if (!id || !name) {
    throw createMalformedResponseError(operation);
  }

  return { id, name };
}

export function parseRepository(
  value: unknown,
  operation = "loading a repository",
): AzureGitRepository {
  if (!isRecord(value)) {
    throw createMalformedResponseError(operation);
  }

  const id = readString(value.id);
  const name = readString(value.name);

  if (!id || !name) {
    throw createMalformedResponseError(operation);
  }

  return {
    defaultBranch: readString(value.defaultBranch),
    id,
    isDisabled: readBoolean(value.isDisabled),
    isFork: readBoolean(value.isFork),
    isInMaintenance: readBoolean(value.isInMaintenance),
    name,
    project: readProject(value.project, operation),
    remoteUrl: readString(value.remoteUrl),
    size: readNumber(value.size),
    sshUrl: readString(value.sshUrl),
    webUrl:
      readString(value.webUrl) ??
      (isRecord(value._links) && isRecord(value._links.web)
        ? readString(value._links.web.href)
        : null),
  };
}

export function parseRepositoryList(value: unknown) {
  if (!isRecord(value)) {
    throw createMalformedResponseError("listing repositories");
  }

  return readArray(value.value).map((repository) =>
    parseRepository(repository, "listing repositories"),
  );
}

export function parseRef(value: unknown): AzureGitRef | null {
  if (!isRecord(value)) {
    return null;
  }

  const name = readString(value.name);
  const objectId = readString(value.objectId);

  if (!name || !objectId) {
    return null;
  }

  return {
    creator: readIdentity(value.creator),
    isLocked: readBoolean(value.isLocked),
    name,
    objectId,
    peeledObjectId: readString(value.peeledObjectId),
    type: name.startsWith("refs/heads/")
      ? "branch"
      : name.startsWith("refs/tags/")
        ? "tag"
        : "other",
  };
}

export function parseRefList(value: unknown) {
  if (!isRecord(value)) {
    throw createMalformedResponseError("listing repository refs");
  }

  return readArray(value.value)
    .map(parseRef)
    .filter((ref): ref is AzureGitRef => ref !== null);
}

export function parseCommitSummary(
  value: unknown,
): AzureGitCommitSummary | null {
  if (!isRecord(value)) {
    return null;
  }

  const commitId = readString(value.commitId);

  if (!commitId) {
    return null;
  }

  return {
    author: readGitPerson(value.author),
    comment: readExactString(value.comment) ?? "",
    commitId,
    committer: readGitPerson(value.committer),
    remoteUrl: readString(value.remoteUrl),
    url: readString(value.url),
  };
}

export function parseCommitList(value: unknown) {
  if (!isRecord(value)) {
    throw createMalformedResponseError("listing commits");
  }

  return readArray(value.value)
    .map(parseCommitSummary)
    .filter((commit): commit is AzureGitCommitSummary => commit !== null);
}

export function parseCommitDetail(value: unknown): AzureGitCommitDetail {
  if (!isRecord(value)) {
    throw createMalformedResponseError("loading a commit");
  }

  const summary = parseCommitSummary(value);

  if (!summary) {
    throw createMalformedResponseError("loading a commit");
  }

  const changeCounts = isRecord(value.changeCounts)
    ? Object.fromEntries(
        Object.entries(value.changeCounts).flatMap(([key, count]) => {
          const parsed = readNumber(count);
          return parsed === null ? [] : [[key, parsed]];
        }),
      )
    : {};
  const push = isRecord(value.push)
    ? {
        date: readString(value.push.date),
        pushId: readNumber(value.push.pushId),
        pushedBy: readIdentity(value.push.pushedBy)?.displayName ?? null,
      }
    : null;

  return {
    ...summary,
    changeCounts,
    parents: readArray(value.parents).flatMap((parent) => {
      const parsed = readString(parent);
      return parsed ? [parsed] : [];
    }),
    push,
    tooManyChanges: readBoolean(value.commitTooManyChanges),
  };
}

export function parseGitItem(value: unknown): AzureGitItem | null {
  if (!isRecord(value)) {
    return null;
  }

  const objectId = readString(value.objectId);
  const itemPath = readExactString(value.path);

  if (!objectId || !itemPath) {
    return null;
  }

  const metadata = isRecord(value.contentMetadata)
    ? value.contentMetadata
    : {};
  const gitObjectType = readString(value.gitObjectType);

  return {
    commitId: readString(value.commitId),
    content: typeof value.content === "string" ? value.content : null,
    contentMetadata: {
      encoding: readNumber(metadata.encoding),
      fileName: readString(metadata.fileName),
      isBinary: readBoolean(metadata.isBinary),
      isImage: readBoolean(metadata.isImage),
      mimeType: readString(metadata.contentType),
    },
    gitObjectType:
      gitObjectType === "blob" ||
      gitObjectType === "tree" ||
      gitObjectType === "commit"
        ? gitObjectType
        : "unknown",
    isFolder: readBoolean(value.isFolder),
    latestChange: parseCommitSummary(value.latestProcessedChange),
    objectId,
    path: itemPath,
    size: readNumber(value.size),
    url: readString(value.url),
  };
}

export function parseGitItemList(value: unknown) {
  if (!isRecord(value)) {
    throw createMalformedResponseError("browsing repository items");
  }

  return readArray(value.value)
    .map(parseGitItem)
    .filter((item): item is AzureGitItem => item !== null);
}

export function parseGitItemResponse(value: unknown) {
  const item = parseGitItem(value);

  if (!item) {
    throw createMalformedResponseError("loading a repository item");
  }

  return item;
}

export function parseCommitChanges(value: unknown) {
  if (!isRecord(value)) {
    throw createMalformedResponseError("loading commit changes");
  }

  return readArray(value.changes).flatMap((change): AzureGitCommitChange[] => {
    if (!isRecord(change) || !isRecord(change.item)) {
      return [];
    }

    const path = readExactString(change.item.path);

    if (!path) {
      return [];
    }
    const gitObjectType = readString(change.item.gitObjectType);

    return [
      {
        changeId: readNumber(change.changeId),
        changeType: readString(change.changeType) ?? "unknown",
        item: {
          gitObjectType:
            gitObjectType === "blob" ||
            gitObjectType === "tree" ||
            gitObjectType === "commit"
              ? gitObjectType
              : "unknown",
          isFolder:
            readBoolean(change.item.isFolder) || gitObjectType === "tree",
          objectId: readString(change.item.objectId),
          path,
          url: readString(change.item.url),
        },
        newContentTemplate: readExactString(change.newContentTemplate),
        originalPath: readExactString(change.originalPath),
      },
    ];
  });
}

export function parsePullRequest(
  value: unknown,
): AzureGitPullRequest | null {
  if (!isRecord(value) || !isRecord(value.repository)) {
    return null;
  }

  const pullRequestId = readNumber(value.pullRequestId);
  const id = readString(value.repository.id);
  const name = readString(value.repository.name);
  const project = isRecord(value.repository.project)
    ? value.repository.project
    : null;
  const projectId = project ? readString(project.id) : null;
  const projectName = project ? readString(project.name) : null;
  const title = readString(value.title);

  if (
    pullRequestId === null ||
    !id ||
    !name ||
    !projectId ||
    !projectName ||
    !title
  ) {
    return null;
  }

  const forkSource = isRecord(value.forkSource) ? value.forkSource : null;
  const sourceRepository =
    forkSource && isRecord(forkSource.repository)
      ? forkSource.repository
      : null;
  const sourceRepositoryId = sourceRepository
    ? readString(sourceRepository.id)
    : null;
  const sourceProjectId =
    sourceRepository && isRecord(sourceRepository.project)
      ? readString(sourceRepository.project.id)
      : null;
  const completionOptions = isRecord(value.completionOptions)
    ? value.completionOptions
    : null;

  return {
    artifactId: readString(value.artifactId),
    closedDate: readString(value.closedDate),
    commits: readArray(value.commits)
      .map(parseCommitSummary)
      .filter((commit): commit is AzureGitCommitSummary => commit !== null),
    // The full identity is kept so the author can be matched by id rather than
    // by display name, which is not unique.
    createdBy: readGitIdentity(value.createdBy),
    creationDate: readString(value.creationDate),
    description: readExactString(value.description),
    isDraft: readBoolean(value.isDraft),
    labels: readArray(value.labels).flatMap((label) => {
      if (!isRecord(label)) {
        return [];
      }

      const labelName = readString(label.name);
      return labelName ? [labelName] : [];
    }),
    lastMergeCommitId: isRecord(value.lastMergeCommit)
      ? readString(value.lastMergeCommit.commitId)
      : null,
    lastMergeSourceCommitId: isRecord(value.lastMergeSourceCommit)
      ? readString(value.lastMergeSourceCommit.commitId)
      : null,
    lastMergeTargetCommitId: isRecord(value.lastMergeTargetCommit)
      ? readString(value.lastMergeTargetCommit.commitId)
      : null,
    mergeStrategy:
      (completionOptions
        ? readString(completionOptions.mergeStrategy)
        : null) ??
      (completionOptions &&
      readBoolean(completionOptions.squashMerge)
        ? "squash"
        : null),
    mergeStatus: readString(value.mergeStatus),
    pullRequestId,
    repository: {
      id,
      name,
      projectId,
      projectName,
    },
    sourceRefName: readString(value.sourceRefName) ?? "",
    sourceRepository:
      sourceRepositoryId && sourceProjectId
        ? {
            id: sourceRepositoryId,
            projectId: sourceProjectId,
          }
        : null,
    status: readString(value.status) ?? "unknown",
    supportsIterations: readBoolean(value.supportsIterations),
    targetRefName: readString(value.targetRefName) ?? "",
    title,
    webUrl:
      isRecord(value._links) && isRecord(value._links.web)
        ? readString(value._links.web.href)
        : null,
    workItemIds: readArray(value.workItemRefs).flatMap((workItem) => {
      if (!isRecord(workItem)) {
        return [];
      }

      const id = readString(workItem.id);
      return id ? [id] : [];
    }),
    reviewers: readArray(value.reviewers)
      .map(parsePullRequestReviewer)
      .filter(
        (reviewer): reviewer is AzureGitPullRequestReviewer =>
          reviewer !== null,
      ),
  };
}

export function parsePullRequestList(value: unknown) {
  if (!isRecord(value)) {
    throw createMalformedResponseError("listing pull requests");
  }

  return readArray(value.value)
    .map(parsePullRequest)
    .filter((pr): pr is AzureGitPullRequest => pr !== null);
}

function parsePullRequestComment(
  value: unknown,
): AzureGitPullRequestComment | null {
  if (!isRecord(value)) {
    return null;
  }

  const id = readNumber(value.id);
  const author = readGitIdentity(value.author);

  if (id === null || !author) {
    return null;
  }

  const rawType = readString(value.commentType);
  const type =
    rawType === "codeChange" ||
    rawType === "system" ||
    rawType === "text"
      ? rawType
      : "unknown";

  return {
    author,
    content: typeof value.content === "string" ? value.content : "",
    id,
    isDeleted: readBoolean(value.isDeleted),
    lastUpdatedDate: readString(value.lastUpdatedDate),
    parentCommentId: readNumber(value.parentCommentId) ?? 0,
    publishedDate: readString(value.publishedDate),
    type,
    usersLiked: readArray(value.usersLiked)
      .map(readGitIdentity)
      .filter((identity): identity is NonNullable<typeof identity> =>
        identity !== null
      ),
  };
}

const THREAD_ACTIVITY_TYPES: Record<
  string,
  AzureGitPullRequestThreadActivity["type"]
> = {
  isdraftupdate: "isDraftUpdate",
  policystatusupdate: "policyStatusUpdate",
  refupdate: "refUpdate",
  reviewersupdate: "reviewersUpdate",
  statusupdate: "statusUpdate",
  voteupdate: "voteUpdate",
};

/**
 * Thread properties arrive as `{ "$type": ..., "$value": ... }` envelopes.
 */
function readThreadProperty(properties: unknown, key: string) {
  if (!isRecord(properties)) {
    return null;
  }

  const property = properties[key];

  if (isRecord(property)) {
    return property.$value ?? null;
  }

  return property ?? null;
}

/**
 * Thread properties are inconsistently typed: the vote result arrives as a
 * `System.String` while the commit count arrives as a `System.Int32`.
 */
function readThreadNumberProperty(properties: unknown, key: string) {
  const value = readThreadProperty(properties, key);
  const parsed =
    typeof value === "string" && value.trim() ? Number(value) : value;

  return readNumber(parsed);
}

/**
 * Every activity type names its actor in a property whose key ends in
 * `ByIdentity`, holding a key into the thread's own `identities` map rather
 * than an identity. Related keys such as `...AddedIdentity` and
 * `...ByInitiatorIdentity` describe other participants and are deliberately not
 * matched.
 */
function readThreadActor(properties: unknown, identities: unknown) {
  if (!isRecord(properties) || !isRecord(identities)) {
    return null;
  }

  const actorKey = Object.keys(properties)
    .filter((key) => key.endsWith("ByIdentity"))
    .sort()[0];

  if (!actorKey) {
    return null;
  }

  const identityKey = readString(readThreadProperty(properties, actorKey));

  return identityKey ? readGitIdentity(identities[identityKey]) : null;
}

function readThreadActivity(
  properties: unknown,
  identities: unknown,
): AzureGitPullRequestThreadActivity | null {
  const rawType = readString(
    readThreadProperty(properties, "CodeReviewThreadType"),
  );

  if (!rawType) {
    return null;
  }

  const rawVote = readThreadNumberProperty(
    properties,
    "CodeReviewVoteResult",
  );

  return {
    actor: readThreadActor(properties, identities),
    newCommitCount: readThreadNumberProperty(
      properties,
      "CodeReviewRefNewCommitsCount",
    ),
    refName: readString(readThreadProperty(properties, "CodeReviewRefName")),
    type: THREAD_ACTIVITY_TYPES[rawType.toLowerCase()] ?? "other",
    voteResult:
      rawVote === -10 ||
      rawVote === -5 ||
      rawVote === 0 ||
      rawVote === 5 ||
      rawVote === 10
        ? rawVote
        : null,
  };
}

export function parsePullRequestThread(
  value: unknown,
): AzureGitPullRequestThread | null {
  if (!isRecord(value)) {
    return null;
  }

  const id = readNumber(value.id);

  if (id === null) {
    return null;
  }

  const threadContext = isRecord(value.threadContext)
    ? value.threadContext
    : null;
  const pullRequestThreadContext = isRecord(value.pullRequestThreadContext)
    ? value.pullRequestThreadContext
    : null;
  const iterationContext =
    pullRequestThreadContext &&
    isRecord(pullRequestThreadContext.iterationContext)
      ? pullRequestThreadContext.iterationContext
      : null;
  const firstComparingIteration = iterationContext
    ? readNumber(iterationContext.firstComparingIteration)
    : null;
  const secondComparingIteration = iterationContext
    ? readNumber(iterationContext.secondComparingIteration)
    : null;

  return {
    activity: readThreadActivity(value.properties, value.identities),
    changeTrackingId: pullRequestThreadContext
      ? readNumber(pullRequestThreadContext.changeTrackingId)
      : null,
    comments: readArray(value.comments)
      .map(parsePullRequestComment)
      .filter(
        (comment): comment is AzureGitPullRequestComment =>
          comment !== null,
      ),
    filePath: threadContext ? readExactString(threadContext.filePath) : null,
    id,
    isDeleted: readBoolean(value.isDeleted),
    iterationContext:
      firstComparingIteration !== null &&
      secondComparingIteration !== null
        ? {
            firstComparingIteration,
            secondComparingIteration,
          }
        : null,
    lastUpdatedDate: readString(value.lastUpdatedDate),
    leftFileEnd: threadContext
      ? readPosition(threadContext.leftFileEnd)
      : null,
    leftFileStart: threadContext
      ? readPosition(threadContext.leftFileStart)
      : null,
    publishedDate: readString(value.publishedDate),
    rightFileEnd: threadContext
      ? readPosition(threadContext.rightFileEnd)
      : null,
    rightFileStart: threadContext
      ? readPosition(threadContext.rightFileStart)
      : null,
    status: readPullRequestThreadStatus(value.status),
  };
}

export function parsePullRequestThreadList(value: unknown) {
  if (!isRecord(value)) {
    throw createMalformedResponseError("listing pull request threads");
  }

  return readArray(value.value)
    .map(parsePullRequestThread)
    .filter((thread): thread is AzureGitPullRequestThread => thread !== null);
}

export function parsePullRequestIteration(
  value: unknown,
): AzureGitPullRequestIteration | null {
  if (!isRecord(value)) {
    return null;
  }

  const id = readNumber(value.id);

  if (id === null) {
    return null;
  }

  return {
    author: readGitIdentity(value.author),
    commonRefCommitId: isRecord(value.commonRefCommit)
      ? readString(value.commonRefCommit.commitId)
      : null,
    createdDate: readString(value.createdDate),
    description: readString(value.description),
    id,
    reason: readString(value.reason) ?? "unknown",
    sourceRefCommitId: isRecord(value.sourceRefCommit)
      ? readString(value.sourceRefCommit.commitId)
      : null,
    targetRefCommitId: isRecord(value.targetRefCommit)
      ? readString(value.targetRefCommit.commitId)
      : null,
    updatedDate: readString(value.updatedDate),
  };
}

export function parsePullRequestIterationList(value: unknown) {
  if (!isRecord(value)) {
    throw createMalformedResponseError("listing pull request iterations");
  }

  return readArray(value.value)
    .map(parsePullRequestIteration)
    .filter(
      (iteration): iteration is AzureGitPullRequestIteration =>
        iteration !== null,
    );
}

export function parsePullRequestChangeList(value: unknown) {
  if (!isRecord(value)) {
    throw createMalformedResponseError("listing pull request changes");
  }

  const items = readArray(value.changeEntries).flatMap(
    (change): AzureGitPullRequestChange[] => {
      if (!isRecord(change) || !isRecord(change.item)) {
        return [];
      }

      const changeTrackingId = readNumber(change.changeTrackingId);
      const path = readExactString(change.item.path);

      if (changeTrackingId === null || !path) {
        return [];
      }

      return [
        {
          changeId: readNumber(change.changeId),
          changeTrackingId,
          changeType: readString(change.changeType) ?? "unknown",
          objectId: readString(change.item.objectId),
          originalObjectId: readString(change.item.originalObjectId),
          originalPath: readExactString(change.originalPath),
          path,
        },
      ];
    },
  );

  return {
    items,
    nextSkip: readNumber(value.nextSkip),
    nextTop: readNumber(value.nextTop),
  };
}

export function parsePullRequestStatusList(value: unknown) {
  if (!isRecord(value)) {
    throw createMalformedResponseError("listing pull request statuses");
  }

  return readArray(value.value).flatMap(
    (status): AzureGitPullRequestStatusCheck[] => {
      if (!isRecord(status) || !isRecord(status.context)) {
        return [];
      }

      const id = readNumber(status.id);
      const name = readString(status.context.name);

      if (id === null || !name) {
        return [];
      }

      return [
        {
          context: {
            genre: readString(status.context.genre),
            name,
          },
          createdBy: readGitIdentity(status.createdBy),
          creationDate: readString(status.creationDate),
          description: readString(status.description),
          id,
          state: readString(status.state) ?? "unknown",
          targetUrl: readString(status.targetUrl),
          updatedDate: readString(status.updatedDate),
        },
      ];
    },
  );
}

export function parsePolicyEvaluationList(value: unknown) {
  if (!isRecord(value)) {
    throw createMalformedResponseError("listing pull request policies");
  }

  return readArray(value.value).flatMap(
    (evaluation): AzureGitPolicyEvaluation[] => {
      if (
        !isRecord(evaluation) ||
        !isRecord(evaluation.configuration) ||
        !isRecord(evaluation.configuration.type)
      ) {
        return [];
      }

      const evaluationId = readString(evaluation.evaluationId);
      const type = readString(evaluation.configuration.type.displayName);

      if (!evaluationId || !type) {
        return [];
      }

      const settings = isRecord(evaluation.configuration.settings)
        ? evaluation.configuration.settings
        : null;
      const requiredReviewerIds = settings
        ? readArray(settings.requiredReviewerIds).flatMap((id) => {
            const value = readString(id);

            return value ? [value] : [];
          })
        : [];
      const scopes = settings
        ? readArray(settings.scope).flatMap((scope) => {
            const refName = isRecord(scope)
              ? readString(scope.refName)
              : null;

            return refName ? [stripRefPrefix(refName)] : [];
          })
        : [];
      const minimumApproverCount = settings
        ? readNumber(settings.minimumApproverCount)
        : null;

      return [
        {
          blocking: readBoolean(evaluation.configuration.isBlocking),
          completedDate: readString(evaluation.completedDate),
          detail:
            scopes.length > 0 || minimumApproverCount !== null
              ? [
                  minimumApproverCount !== null && requiredReviewerIds.length === 0
                    ? `${minimumApproverCount} required`
                    : null,
                  scopes.length > 0 ? scopes.join(", ") : null,
                ]
                  .filter(Boolean)
                  .join(" · ") || null
              : null,
          evaluationId,
          requiredReviewerIds,
          startedDate: readString(evaluation.startedDate),
          status: readString(evaluation.status) ?? "unknown",
          type,
        },
      ];
    },
  );
}

export function parsePush(value: unknown): AzureGitPush | null {
  if (!isRecord(value)) {
    return null;
  }

  const pushId = readNumber(value.pushId);

  if (pushId === null) {
    return null;
  }

  return {
    commits: readArray(value.commits)
      .map(parseCommitSummary)
      .filter((commit): commit is AzureGitCommitSummary => commit !== null),
    commitsTruncated: false,
    date: readString(value.date),
    pushId,
    pushedBy: readIdentity(value.pushedBy),
    refUpdates: readArray(value.refUpdates).flatMap((refUpdate) => {
      if (!isRecord(refUpdate)) {
        return [];
      }

      const name = readString(refUpdate.name);

      return name
        ? [
            {
              name,
              newObjectId: readString(refUpdate.newObjectId),
              oldObjectId: readString(refUpdate.oldObjectId),
            },
          ]
        : [];
    }),
    webUrl:
      isRecord(value._links) && isRecord(value._links.web)
        ? readString(value._links.web.href)
        : null,
  };
}

export function parsePushList(value: unknown) {
  if (!isRecord(value)) {
    throw createMalformedResponseError("listing repository pushes");
  }

  return readArray(value.value)
    .map(parsePush)
    .filter((push): push is AzureGitPush => push !== null);
}

export function parseSearchResults(value: unknown) {
  if (!isRecord(value)) {
    throw createMalformedResponseError("searching repository code");
  }

  const rawItems = readArray(value.results);
  const items = rawItems.flatMap(
    (result): AzureGitSearchResult[] => {
      if (
        !isRecord(result) ||
        !isRecord(result.project) ||
        !isRecord(result.repository)
      ) {
        return [];
      }

      const projectId = readString(result.project.id);
      const projectName = readString(result.project.name);
      const repositoryId = readString(result.repository.id);
      const repositoryName = readString(result.repository.name);
      const path = readExactString(result.path);
      const fileName = readExactString(result.fileName);

      if (
        !projectId ||
        !projectName ||
        !repositoryId ||
        !repositoryName ||
        !path ||
        !fileName
      ) {
        return [];
      }

      const version = readArray(result.versions).find((candidate) => {
        return isRecord(candidate) && readString(candidate.branchName);
      });

      return [
        {
          branch: isRecord(version)
            ? (readString(version.branchName) ?? "")
            : "",
          changeId: isRecord(version)
            ? readString(version.changeId)
            : null,
          contentId: readString(result.contentId),
          fileName,
          matches: isRecord(result.matches)
            ? Object.entries(result.matches).flatMap(([field, matches]) =>
                readArray(matches).flatMap((match) => {
                  if (!isRecord(match)) {
                    return [];
                  }

                  const charOffset = readNumber(match.charOffset);
                  const length = readNumber(match.length);

                  return charOffset === null || length === null
                    ? []
                    : [{ charOffset, field, length }];
                }),
              )
            : [],
          path,
          project: {
            id: projectId,
            name: projectName,
          },
          repository: {
            id: repositoryId,
            name: repositoryName,
          },
        },
      ];
    },
  );

  return {
    infoCode: readNumber(value.infoCode),
    items,
    rawItemCount: rawItems.length,
    totalCount: readNumber(value.count) ?? items.length,
  };
}
