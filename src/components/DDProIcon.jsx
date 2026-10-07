import { useId } from "react";

const iconPaths = {
  edit: (
    <>
      <path d="m5 15.8 10.9-10.9a2.25 2.25 0 0 1 3.2 0l.9.9a2.25 2.25 0 0 1 0 3.2L9.1 19.9 4 21l1-5.2Z" />
      <path d="m14.4 6.4 4.2 4.2M4.8 16.1l4 4" />
      <path className="ddpro-icon-accent" d="m6.4 15.4 7.7-7.7" />
    </>
  ),
  delete: (
    <>
      <path d="M4 7h16M9 7V4.8h6V7m-9 0 1 13h10l1-13M10 10.5v6m4-6v6" />
      <path className="ddpro-icon-accent" d="M8 7h8" />
    </>
  ),
  save: (
    <>
      <path d="M5 3.8h12l3 3V20H4V3.8h1Z" />
      <path d="M8 4v5h8V4M8 20v-7h8v7" />
      <path className="ddpro-icon-accent" d="M9.5 15.5h5" />
    </>
  ),
  print: (
    <>
      <path d="M7 8V4h10v4M7 17H4V9h16v8h-3M7 14h10v6H7z" />
      <path d="M16.5 11.5h.01" />
      <path className="ddpro-icon-accent" d="M9 16h6" />
    </>
  ),
  settings: (
    <>
      <path d="m10 2.8 4-.1.7 2.5a7.5 7.5 0 0 1 1.7 1l2.5-.8 2 3.5-1.8 1.9a7.7 7.7 0 0 1 0 2l1.8 1.9-2 3.5-2.5-.8a7.5 7.5 0 0 1-1.7 1l-.7 2.5-4 .1-.7-2.5a7.5 7.5 0 0 1-1.7-1l-2.5.8-2-3.5 1.8-1.9a7.7 7.7 0 0 1 0-2L3.1 9l2-3.5 2.5.8a7.5 7.5 0 0 1 1.7-1L10 2.8Z" />
      <circle cx="12" cy="12" r="3.2" />
      <circle className="ddpro-icon-accent" cx="12" cy="12" r="1.7" />
    </>
  ),
  add: (
    <>
      <path d="M12 3.5v17M3.5 12h17" />
      <path className="ddpro-icon-accent" d="M12 5v14M5 12h14" />
    </>
  ),
};

function DDProIcon({ name, className = "" }) {
  const gradientId = useId().replace(/:/g, "");

  return (
    <span className={`ddpro-icon-medallion ${className}`.trim()} aria-hidden="true">
      <svg viewBox="0 0 24 24" focusable="false">
        <defs>
          <linearGradient id={`${gradientId}-metal`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#ffffff" />
            <stop offset=".42" stopColor="#c8d4d5" />
            <stop offset="1" stopColor="#758789" />
          </linearGradient>
        </defs>
        <g
          className="ddpro-icon-art"
          fill={`url(#${gradientId}-metal)`}
          stroke="#e5f2f0"
          strokeLinejoin="round"
          strokeLinecap="round"
          strokeWidth="1.5"
        >
          {iconPaths[name] || iconPaths.add}
        </g>
      </svg>
    </span>
  );
}

export default DDProIcon;
