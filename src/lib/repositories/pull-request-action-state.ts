export type PullRequestActionState = {
  message: string;
  status: "error" | "idle" | "success";
};

export const INITIAL_PULL_REQUEST_ACTION_STATE: PullRequestActionState = {
  message: "",
  status: "idle",
};
