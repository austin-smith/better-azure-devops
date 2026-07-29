export type AzureRepositoryIdentity = {
  organization: string;
  projectId: string;
  repositoryId: string;
};

export type AzureGitIdentity = {
  displayName: string;
  id: string | null;
  imageUrl: string | null;
  isContainer: boolean;
};

export type GitVersionType = "branch" | "commit" | "tag";

export type GitVersionDescriptor = {
  type: GitVersionType;
  value: string;
};

export type AzureGitRepository = {
  defaultBranch: string | null;
  id: string;
  isDisabled: boolean;
  isFork: boolean;
  isInMaintenance: boolean;
  name: string;
  project: {
    id: string;
    name: string;
  };
  remoteUrl: string | null;
  size: number | null;
  sshUrl: string | null;
  webUrl: string | null;
};

export type AzureGitRef = {
  creator: {
    displayName: string;
    imageUrl: string | null;
  } | null;
  isLocked: boolean;
  name: string;
  objectId: string;
  peeledObjectId: string | null;
  type: "branch" | "tag" | "other";
};

export type AzureGitPerson = {
  date: string | null;
  email: string | null;
  imageUrl: string | null;
  name: string | null;
};

export type AzureGitCommitSummary = {
  author: AzureGitPerson;
  comment: string;
  commitId: string;
  committer: AzureGitPerson;
  remoteUrl: string | null;
  url: string | null;
};

export type AzureGitItem = {
  commitId: string | null;
  content: string | null;
  contentMetadata: {
    encoding: number | null;
    fileName: string | null;
    isBinary: boolean;
    isImage: boolean;
    mimeType: string | null;
  };
  gitObjectType: "blob" | "commit" | "tree" | "unknown";
  isFolder: boolean;
  latestChange: AzureGitCommitSummary | null;
  objectId: string;
  path: string;
  size: number | null;
  url: string | null;
};

export type AzureGitCommitChange = {
  changeId: number | null;
  changeType: string;
  item: {
    gitObjectType: "blob" | "commit" | "tree" | "unknown";
    isFolder: boolean;
    objectId: string | null;
    path: string;
    url: string | null;
  };
  newContentTemplate: string | null;
  originalPath: string | null;
};

export type AzureGitCommitDetail = AzureGitCommitSummary & {
  changeCounts: Record<string, number>;
  parents: string[];
  push: {
    date: string | null;
    pushId: number | null;
    pushedBy: string | null;
  } | null;
  tooManyChanges: boolean;
};

export type AzureGitPullRequest = {
  artifactId: string | null;
  closedDate: string | null;
  createdBy: AzureGitIdentity | null;
  creationDate: string | null;
  commits: AzureGitCommitSummary[];
  description: string | null;
  isDraft: boolean;
  labels: string[];
  lastMergeCommitId: string | null;
  lastMergeSourceCommitId: string | null;
  lastMergeTargetCommitId: string | null;
  mergeStrategy: string | null;
  mergeStatus: string | null;
  pullRequestId: number;
  repository: {
    id: string;
    name: string;
    projectId: string;
    projectName: string;
  };
  sourceRefName: string;
  sourceRepository: {
    id: string;
    projectId: string;
  } | null;
  status: string;
  supportsIterations: boolean;
  targetRefName: string;
  title: string;
  webUrl: string | null;
  workItemIds: string[];
  reviewers: AzureGitPullRequestReviewer[];
};

export type AzureGitPullRequestVote = -10 | -5 | 0 | 5 | 10;

export type AzureGitPullRequestReviewer = AzureGitIdentity & {
  hasDeclined: boolean;
  isFlagged: boolean;
  isRequired: boolean;
  vote: AzureGitPullRequestVote;
  votedFor: Array<{
    displayName: string;
    id: string | null;
    vote: AzureGitPullRequestVote;
  }>;
};

export type AzureGitPullRequestComment = {
  author: AzureGitIdentity;
  content: string;
  id: number;
  isDeleted: boolean;
  lastUpdatedDate: string | null;
  parentCommentId: number;
  publishedDate: string | null;
  type: "codeChange" | "system" | "text" | "unknown";
  usersLiked: AzureGitIdentity[];
};

export type AzureGitPullRequestThreadStatus =
  | "active"
  | "byDesign"
  | "closed"
  | "fixed"
  | "pending"
  | "unknown"
  | "wontFix";

/**
 * Azure DevOps tags non-discussion threads with `CodeReviewThreadType` and
 * carries the event payload alongside it, which is the only reliable way to
 * tell repository activity apart from a real review conversation.
 */
export type AzureGitPullRequestThreadActivity = {
  /**
   * Who performed the event. Azure DevOps authors most activity comments as its
   * own service account, and names the real actor in the thread properties
   * instead, so this is the identity worth showing.
   */
  actor: AzureGitIdentity | null;
  newCommitCount: number | null;
  refName: string | null;
  type:
    | "isDraftUpdate"
    | "other"
    | "policyStatusUpdate"
    | "refUpdate"
    | "reviewersUpdate"
    | "statusUpdate"
    | "voteUpdate";
  voteResult: AzureGitPullRequestVote | null;
};

export type AzureGitPullRequestThread = {
  activity: AzureGitPullRequestThreadActivity | null;
  changeTrackingId: number | null;
  comments: AzureGitPullRequestComment[];
  filePath: string | null;
  id: number;
  isDeleted: boolean;
  iterationContext: {
    firstComparingIteration: number;
    secondComparingIteration: number;
  } | null;
  lastUpdatedDate: string | null;
  leftFileEnd: {
    line: number;
    offset: number;
  } | null;
  leftFileStart: {
    line: number;
    offset: number;
  } | null;
  publishedDate: string | null;
  rightFileEnd: {
    line: number;
    offset: number;
  } | null;
  rightFileStart: {
    line: number;
    offset: number;
  } | null;
  status: AzureGitPullRequestThreadStatus;
};

export type AzureGitPullRequestIteration = {
  author: AzureGitIdentity | null;
  commonRefCommitId: string | null;
  createdDate: string | null;
  description: string | null;
  id: number;
  reason: string;
  sourceRefCommitId: string | null;
  targetRefCommitId: string | null;
  updatedDate: string | null;
};

export type AzureGitPullRequestChange = {
  changeId: number | null;
  changeTrackingId: number;
  changeType: string;
  objectId: string | null;
  originalObjectId: string | null;
  originalPath: string | null;
  path: string;
};

export type AzureGitPullRequestStatusCheck = {
  context: {
    genre: string | null;
    name: string;
  };
  createdBy: AzureGitIdentity | null;
  creationDate: string | null;
  description: string | null;
  id: number;
  state: string;
  targetUrl: string | null;
  updatedDate: string | null;
};

export type AzureGitPolicyEvaluation = {
  blocking: boolean;
  completedDate: string | null;
  /**
   * An organization can configure the same policy type several times with
   * different settings, so the type name alone renders as duplicate rows.
   * This carries whatever distinguishes one configuration from another.
   */
  detail: string | null;
  evaluationId: string;
  requiredReviewerIds: string[];
  startedDate: string | null;
  status: string;
  type: string;
};

export type AzureGitPush = {
  commits: AzureGitCommitSummary[];
  commitsTruncated: boolean;
  date: string | null;
  pushId: number;
  pushedBy: {
    displayName: string;
    imageUrl: string | null;
  } | null;
  refUpdates: Array<{
    name: string;
    newObjectId: string | null;
    oldObjectId: string | null;
  }>;
  webUrl: string | null;
};

export type AzureGitSearchResult = {
  branch: string;
  changeId: string | null;
  contentId: string | null;
  fileName: string;
  matches: Array<{
    charOffset: number;
    field: string;
    length: number;
  }>;
  path: string;
  project: {
    id: string;
    name: string;
  };
  repository: {
    id: string;
    name: string;
  };
};

export type AzureGitSearchResponse = {
  infoCode: number | null;
  items: AzureGitSearchResult[];
  totalCount: number;
};
