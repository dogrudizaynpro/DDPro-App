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
  refresh: (
    <>
      <path d="M19 8.5A7.5 7.5 0 0 0 5.8 6L4 8m0 0V4m0 4h4m-3 3.5A7.5 7.5 0 0 0 18.2 18l1.8-2m0 0v4m0-4h-4" />
      <path className="ddpro-icon-accent" d="M7 8a6 6 0 0 1 9.8-1.8M17 16a6 6 0 0 1-9.8 1.8" />
    </>
  ),
  search: (
    <>
      <circle cx="10.8" cy="10.8" r="6.6" />
      <path d="m16 16 4.5 4.5" />
      <path className="ddpro-icon-accent" d="M7.8 10.8h6" />
    </>
  ),
  close: (
    <>
      <path d="m5 5 14 14M19 5 5 19" />
      <path className="ddpro-icon-accent" d="m8 8 8 8" />
    </>
  ),
  upload: (
    <>
      <path d="M4 15v5h16v-5M12 16V3m0 0L7.5 7.5M12 3l4.5 4.5" />
      <path className="ddpro-icon-accent" d="M8.5 7.5 12 4l3.5 3.5" />
    </>
  ),
  download: (
    <>
      <path d="M4 15v5h16v-5M12 3v13m0 0 4.5-4.5M12 16l-4.5-4.5" />
      <path className="ddpro-icon-accent" d="m8.5 12.5 3.5 3.5 3.5-3.5" />
    </>
  ),
  send: (
    <>
      <path d="m3 11 18-8-7.8 18-2.7-7.5L3 11Z" />
      <path d="m10.5 13.5 5-5" />
      <path className="ddpro-icon-accent" d="m10.5 13.5 5-5" />
    </>
  ),
  check: (
    <>
      <path d="m4 12.5 5.2 5.2L20 6.8" />
      <path className="ddpro-icon-accent" d="m5.5 12.5 3.7 3.7 8-8" />
    </>
  ),
  view: (
    <>
      <path d="M2.5 12s3.4-6 9.5-6 9.5 6 9.5 6-3.4 6-9.5 6-9.5-6-9.5-6Z" />
      <circle cx="12" cy="12" r="2.7" />
      <path className="ddpro-icon-accent" d="M9.8 12a2.2 2.2 0 0 1 2.2-2.2" />
    </>
  ),
  link: (
    <>
      <path d="m9.5 14.5-1.8 1.8a4 4 0 0 1-5.7-5.7l4-4a4 4 0 0 1 5.7 0M14.5 9.5l1.8-1.8a4 4 0 1 1 5.7 5.7l-4 4a4 4 0 0 1-5.7 0" />
      <path d="m8.5 15.5 7-7" />
      <path className="ddpro-icon-accent" d="m9.5 14.5 5-5" />
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
