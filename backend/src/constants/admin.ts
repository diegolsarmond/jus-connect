const parseAdminUserIds = (value: string | undefined): number[] => {
  if (!value) {
    return [];
  }

  return value
    .split(',')
    .map((raw) => raw.trim())
    .filter((raw) => raw.length > 0)
    .map((raw) => Number.parseInt(raw, 10))
    .filter((id) => Number.isFinite(id));
};

const defaultAdminIds = parseAdminUserIds(process.env.ADMIN_USER_IDS);

if (defaultAdminIds.length === 0) {
  defaultAdminIds.push(3);
}

const adminUserIdSet = new Set<number>(defaultAdminIds);

export const ADMIN_USER_IDS = Object.freeze(Array.from(adminUserIdSet));

export const isAdminUserId = (userId: number): boolean => adminUserIdSet.has(userId);
