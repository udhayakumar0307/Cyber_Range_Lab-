export function getRoleHome(role?: string | null): string {
  if (role === "sys_admin" || role === "admin") return "/sys-admin"
  if (role === "course_admin") return "/admin-ctf"
  return "/dashboard"
}

export function getAdminEntry(role?: string | null): string | null {
  if (role === "sys_admin" || role === "admin") return "/sys-admin"
  if (role === "course_admin") return "/admin-ctf"
  return null
}
