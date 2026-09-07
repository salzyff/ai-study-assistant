export function csvCell(value) {
  let text = String(value ?? "");
  if (/^[\s]*[=+@-]/.test(text) || /^[\t\r\n]/.test(text)) text = "'" + text;
  return '"' + text.replaceAll('"', '""') + '"';
}
export function usersCsv(users) {
  const rows = [["Name", "Email", "Role", "Joined", "Last sign-in"], ...users.map(u => [u.displayName, u.email, u.isAdmin ? "Admin" : "Member", u.createdAt, u.lastSignInAt])];
  return rows.map(row => row.map(csvCell).join(",")).join("\r\n");
}
