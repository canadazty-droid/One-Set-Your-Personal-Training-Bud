import Link from "next/link";

export function OsNav({ current }: { current: string }) {
  const items = [["/dashboard", "Today"], ["/training-plan", "4-week plan"], ["/workout-log", "Log workout"], ["/review", "Weekly review"]];
  const activePath = current === "/plan" ? "/training-plan" : current === "/log" ? "/workout-log" : current;
  return <header className="os-nav"><Link href="/" className="os-brand"><b>练一下</b><span>ONE SET</span></Link><nav>{items.map(([href, label]) => <Link className={activePath === href ? "active" : ""} href={href} key={href}>{label}</Link>)}</nav></header>;
}
