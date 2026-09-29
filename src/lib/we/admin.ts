import "server-only";
import { AppError, audit, mutate, type Actor } from "./store";

export async function updateSettings(actor: Actor, input: { longSessionHours?: unknown; noStartGraceMinutes?: unknown }) {
  const longSessionHours = Number(input.longSessionHours);
  const noStartGraceMinutes = Number(input.noStartGraceMinutes);
  if (!Number.isFinite(longSessionHours) || longSessionHours < 6 || longSessionHours > 16) {
    throw new AppError(400, "Long session warning must be between 6 and 16 hours.");
  }
  if (!Number.isInteger(noStartGraceMinutes) || noStartGraceMinutes < 0 || noStartGraceMinutes > 180) {
    throw new AppError(400, "Grace period must be between 0 and 180 minutes.");
  }
  return mutate((store) => {
    const before = { longSessionHours: store.settings.longSessionHours, noStartGraceMinutes: store.settings.noStartGraceMinutes };
    store.settings.longSessionHours = longSessionHours;
    store.settings.noStartGraceMinutes = noStartGraceMinutes;
    audit(store, actor, { entity: "settings", entityId: "warnings", action: "updated", before, after: { longSessionHours, noStartGraceMinutes } });
    return store.settings;
  });
}

export async function markNotificationsRead(actor: Actor) {
  return mutate((store) => {
    for (const n of store.notifications) if (n.userId === actor.id) n.read = true;
    return { ok: true };
  });
}
