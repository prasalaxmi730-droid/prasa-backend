import bcrypt from "bcryptjs";

const BCRYPT_PREFIX = /^\$2[aby]\$/;
const SALT_ROUNDS = 10;

export const isBcryptHash = (value) => {
  if (!value || typeof value !== "string") return false;
  return BCRYPT_PREFIX.test(value);
};

export const hashPassword = async (plainText) => {
  return bcrypt.hash(plainText, SALT_ROUNDS);
};

// Transition-safe password check:
// 1) If already bcrypt hash -> bcrypt compare
// 2) If legacy plain text -> direct compare
// Returns whether valid and whether caller should upgrade DB hash.
export const verifyPasswordTransitionSafe = async (inputPassword, storedPassword) => {
  if (!storedPassword) return { valid: false, needsUpgrade: false };

  if (isBcryptHash(storedPassword)) {
    const valid = await bcrypt.compare(inputPassword, storedPassword);
    return { valid, needsUpgrade: false };
  }

  const valid = inputPassword === storedPassword;
  return { valid, needsUpgrade: valid };
};
