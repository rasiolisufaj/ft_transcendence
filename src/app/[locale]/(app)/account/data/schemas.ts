import { z } from "zod";

export const deleteAccountSchema = z.object({
  password: z.string().min(1, "passwordRequired").max(200, "passwordTooLong"),
});