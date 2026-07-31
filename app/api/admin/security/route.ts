import { getRecoveryQuestion, isAdmin, setRecoveryQuestion } from "@/lib/admin";

export async function GET() {
  if (!(await isAdmin())) return Response.json({ error: "Unauthorized" }, { status: 401 });
  return Response.json({ question: await getRecoveryQuestion() });
}

export async function POST(request: Request) {
  if (!(await isAdmin())) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { question, answer } = await request.json();
  if (String(question || "").trim().length < 8) return Response.json({ error: "Please enter a complete security question." }, { status: 400 });
  if (String(answer || "").trim().length < 3) return Response.json({ error: "The answer must be at least 3 characters." }, { status: 400 });
  await setRecoveryQuestion(String(question), String(answer));
  return Response.json({ ok: true });
}
