import type { SessionServiceApi } from "./api";
import type { SessionService } from "./index";
import { getSessionServiceState } from "./state";

export const sessionServiceWriteMethods: Pick<
  SessionServiceApi,
  "storeMessage" | "deleteLatestExchange" | "onActivity" | "rename"
> &
  ThisType<SessionService> = {
  storeMessage(message) {
    getSessionServiceState(this).writes.storeMessage(message);
  },

  deleteLatestExchange(sessionId, options) {
    return getSessionServiceState(this).writes.deleteLatestExchange(
      sessionId,
      options,
    );
  },

  onActivity(listener) {
    return getSessionServiceState(this).writes.onActivity(listener);
  },

  rename(sessionId, title) {
    return getSessionServiceState(this).writes.rename(sessionId, title);
  },
};
