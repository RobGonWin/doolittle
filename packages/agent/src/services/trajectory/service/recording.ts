import type { TrajectoryService } from "../service";
import { getTrajectoryServiceState } from "./state";
import type { TrajectoryServiceApi } from "./types";

export const trajectoryServiceRecordingMethods: Pick<
  TrajectoryServiceApi,
  "recordEvent" | "recentEvents"
> = {
  recordEvent(this: TrajectoryService, input) {
    return getTrajectoryServiceState(this).eventJournal.append(input);
  },

  recentEvents(this: TrajectoryService, limit = 100, filters = {}) {
    return getTrajectoryServiceState(this).eventJournal.recent(limit, filters);
  },
};
