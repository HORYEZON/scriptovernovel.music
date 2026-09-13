// app/api/auth/check-password/route.ts
//
// POST { email, password } — lets LoginForm.tsx know whether to show the
// authenticator-code field *before* actually attempting sign-in. This never
// issues a session or a cookie of any kind — it's a UX pre-check, not an
// auth step. The real gate is still lib/auth.ts's authorize(), which
// independently re-checks the password and (if enabled) the code; a caller
// that skips this endpoint and goes straight to signIn("credentials") gets
// exactly the same enforcement, just without the two-step UI.
//
// Same exposure as the credentials provider itself already has (an
// unauthenticated password check), so this adds no new class of risk — just
// mirrors it. Matches forgot-password's convention of a single generic
// error rather than distinguishing "no such user" from "wrong password".
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const bodySchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1),
});

const GENERIC_ERROR = "Invalid email or password.";

export async function POST(req: Request) {
  let email: string, password: string;
  try {
    ({ email, password } = bodySchema.parse(await req.json()));
  } catch {
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 400 });
  }

  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user?.password || !(await bcrypt.compare(password, user.password))) {
      return NextResponse.json({ error: GENERIC_ERROR }, { status: 401 });
    }

    return NextResponse.json({ ok: true, totpRequired: user.totpEnabled });
  } catch (err) {
    console.error("[check-password]", err);
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 500 });
  }
}
