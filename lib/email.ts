type EmailInput = { to: string; subject: string; html: string };

export function ownerEmail() {
  return process.env.ADMIN_EMAIL || process.env.SHIP_FROM_EMAIL || "";
}

export async function sendTransactionalEmail({ to, subject, html }: EmailInput) {
  const apiKey = process.env.RESEND_API_KEY || "";
  const from = process.env.EMAIL_FROM || "Jewelry Dept. <orders@jewelrydept.co>";
  if (!apiKey || !to) return { sent: false, reason: "Email is not configured." };
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: [to], subject, html }),
  });
  if (!response.ok) return { sent: false, reason: "Email provider rejected the message." };
  return { sent: true };
}

export function escapeHtml(value: unknown) {
  return String(value ?? "").replace(/[&<>"']/g, character => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;",
  }[character] || character));
}
